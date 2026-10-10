import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
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

export async function GET(request: Request) {
  await dbConnect();

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

  const match: Record<string, unknown> = conditions.length ? { $and: conditions } : {};

  try {
    const total = await AuditRecord.countDocuments(match).maxTimeMS(20_000);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Clamp so a filter that shrinks the result never leaves the user on an empty page.
    const effectivePage = Math.min(page, totalPages);

    const rows = await AuditRecord.find(match)
      .sort({ date: -1, audit_id: 1, _id: 1 })
      .skip((effectivePage - 1) * pageSize)
      .limit(pageSize)
      .select("-uploadId -createdAt -updatedAt")
      .lean()
      .allowDiskUse(true)
      .maxTimeMS(20_000);

    return NextResponse.json({
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
