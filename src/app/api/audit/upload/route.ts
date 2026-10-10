import { Readable } from "node:stream";
import Busboy from "busboy";
import { parse } from "@fast-csv/parse";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { AUDIT_HEADERS, mapCsvRow, type AuditCsvRow } from "@/lib/audit/csvMapper";
import AuditRecord from "@/models/AuditRecord";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_COLUMNS = 100;
const BATCH_SIZE = 500;

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function escapeMessage(error: unknown) {
  return error instanceof Error ? error.message : "CSV upload failed.";
}

export async function POST(request: Request) {
  if (!request.body) {
    return NextResponse.json({ error: "Request body is empty." }, { status: 400 });
  }

  await dbConnect();
  const uploadId = new mongoose.Types.ObjectId();
  let fileSeen = false;
  let fileTooLarge = false;
  let processingError: Error | null = null;
  let originalFilename = "audit.csv";

  const headers = Object.fromEntries(request.headers.entries());
  const busboy = Busboy({
    headers,
    limits: { files: 1, fileSize: MAX_FILE_SIZE, fields: 10 },
  });

  const work = new Promise<{ rowCount: number; filename: string }>((resolve, reject) => {
    let parserPromise: Promise<void> | null = null;

    busboy.on("file", (fieldName, fileStream, info) => {
      if (fieldName !== "file" || fileSeen) {
        fileStream.resume();
        return;
      }

      fileSeen = true;
      originalFilename = info.filename || "audit.csv";
      if (!originalFilename.toLowerCase().endsWith(".csv")) {
        processingError = new Error("Please upload a .csv file.");
        fileStream.resume();
        return;
      }

      fileStream.on("limit", () => {
        fileTooLarge = true;
        processingError = new Error("File exceeds the 10 MiB upload limit.");
      });

      const parser = parse<AuditCsvRow, AuditCsvRow>({
        headers: (headers) => headers.map((header) => normalizeHeader(header ?? "")),
        ignoreEmpty: true,
        trim: true,
        discardUnmappedColumns: false,
        strictColumnHandling: true,
      });

      parserPromise = (async () => {
        let batch: ReturnType<typeof mapCsvRow>[] = [];
        let rowCount = 0;
        let validatedHeaders = false;

        parser.on("data-invalid", () => {
          processingError = new Error("CSV contains a row with a different number of columns than the header.");
          parser.destroy(processingError);
        });

        for await (const row of parser) {
          if (processingError) throw processingError;

          if (!validatedHeaders) {
            const actualHeaders = Object.keys(row).map(normalizeHeader);
            if (actualHeaders.length > MAX_COLUMNS) {
              throw new Error(`CSV has too many columns. Maximum allowed is ${MAX_COLUMNS}.`);
            }
            const missing = AUDIT_HEADERS.filter((header) => !actualHeaders.includes(header));
            const extra = actualHeaders.filter((header) => !AUDIT_HEADERS.includes(header as (typeof AUDIT_HEADERS)[number]));
            if (missing.length || extra.length) {
              throw new Error(
                `CSV headers do not match the audit format. Missing: ${missing.join(", ") || "none"}. Unexpected: ${extra.join(", ") || "none"}.`
              );
            }
            validatedHeaders = true;
          }

          const normalizedRow: AuditCsvRow = {};
          for (const [key, value] of Object.entries(row)) {
            normalizedRow[normalizeHeader(key)] = value == null ? "" : String(value);
          }

          if (!normalizedRow.audit_id?.trim()) {
            throw new Error(`Row ${rowCount + 2} has an empty audit_id.`);
          }

          batch.push(mapCsvRow(normalizedRow, uploadId));
          rowCount += 1;

          if (batch.length >= BATCH_SIZE) {
            const operations = batch.map((record) => ({
              updateOne: {
                filter: { audit_id: record.audit_id },
                update: { $set: record },             
                upsert: true,                         
              },
            }));
            await AuditRecord.bulkWrite(operations, { ordered: false });
            batch = [];
          }
        }

        if (!validatedHeaders) {
          throw new Error("CSV has no data rows or could not be parsed. Ensure it includes a header row and at least one data row.");
        }

        if (batch.length) {
          const operations = batch.map((record) => ({
            updateOne: {
              filter: { audit_id: record.audit_id },
              update: { $set: record },
              upsert: true,
            },
          }));
          await AuditRecord.bulkWrite(operations, { ordered: false });
        }

        resolve({ rowCount, filename: originalFilename });
      })().catch(reject);

      fileStream.on("error", reject);
      fileStream.pipe(parser);
    });

    busboy.on("filesLimit", () => {
      processingError = new Error("Only one CSV file can be uploaded at a time.");
    });
    busboy.on("error", reject);
    busboy.on("finish", async () => {
      try {
        if (!fileSeen) throw new Error("No file received. Send the CSV as multipart field named 'file'.");
        if (processingError) throw processingError;
        if (parserPromise) await parserPromise;
        else throw new Error("The CSV file could not be processed.");
      } catch (error) {
        reject(error);
      }
    });

    const nodeRequestStream = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream);
    nodeRequestStream.on("error", reject);
    nodeRequestStream.pipe(busboy);
  });

  try {
    const result = await work;
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = fileTooLarge ? "File exceeds the 1 GiB upload limit." : escapeMessage(processingError ?? error);
    await AuditRecord.deleteMany({ uploadId }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
