import mongoose from "mongoose";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import CsvDataset from "@/models/CsvDataset";
import AuditRecord from "@/models/AuditRecord";
import { AUDIT_HEADERS } from "@/lib/audit/csvMapper";

const PAGE_SIZE_MAX = 100;
const SEARCHABLE_FIELDS = new Set<string>(AUDIT_HEADERS);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ datasetId: string }> }
) {
  const { datasetId } = await context.params;
  if (!mongoose.isValidObjectId(datasetId)) {
    return NextResponse.json({ error: "Invalid dataset ID." }, { status: 400 });
  }

  await dbConnect();
  const dataset = await CsvDataset.findOne({ _id: datasetId, status: "ready" }).lean();
  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found or not ready." }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = safeInteger(url.searchParams.get("page"), 1, 1, 1_000_000_000);
  const pageSize = safeInteger(url.searchParams.get("pageSize"), 20, 1, PAGE_SIZE_MAX);

  const conditions: Record<string, unknown>[] = [];
  for (const [key, rawValue] of url.searchParams.entries()) {
    if (!key.startsWith("f_")) continue;
    const field = key.slice(2);
    const value = rawValue.trim();
    if (!value || !SEARCHABLE_FIELDS.has(field)) continue;

    conditions.push({
      $expr: {
        $regexMatch: {
          input: {
            $convert: {
              input: `$${field}`,
              to: "string",
              onError: "",
              onNull: "",
            },
          },
          regex: escapeRegex(value),
          options: "i",
        },
      },
    });
  }

  const match: Record<string, unknown> = { datasetId: new mongoose.Types.ObjectId(datasetId) };
  if (conditions.length) match.$and = conditions;

  try {
    const total = await AuditRecord.countDocuments(match).maxTimeMS(20_000);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const effectivePage = Math.min(page, totalPages);

    const rows = await AuditRecord.find(match)
      .sort({ date: -1, audit_id: 1, _id: 1 })
      .skip((effectivePage - 1) * pageSize)
      .limit(pageSize)
      .select("-datasetId -createdAt -updatedAt")
      .lean()
      .allowDiskUse(true)
      .maxTimeMS(20_000);

    return NextResponse.json({
      dataset: {
        id: String(dataset._id),
        filename: dataset.filename,
        rowCount: dataset.rowCount,
        columns: dataset.columns,
      },
      rows,
      pagination: {
        page: effectivePage,
        pageSize,
        total,
        totalPages,
        hasPreviousPage: effectivePage > 1,
        hasNextPage: effectivePage < totalPages,
      },
    });
  } catch (error) {
    console.error("[audit/records] query failed:", error);
    return NextResponse.json({ error: "Could not retrieve audit records." }, { status: 500 });
  }
}
