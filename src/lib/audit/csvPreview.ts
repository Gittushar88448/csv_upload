const PREVIEW_BYTES = 256 * 1024;

export type CsvPreview = { headers: string[]; rows: string[][] };

function parseCsvText(text: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') inQuotes = false;
      else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") { record.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += char;
  }
  if (field || record.length) { record.push(field); records.push(record); }
  return records.filter((r) => r.some((value) => value.trim() !== ""));
}

export async function readCsvPreview(file: File, maxRows = 10): Promise<CsvPreview> {
  const truncated = file.size > PREVIEW_BYTES;
  const records = parseCsvText(await file.slice(0, PREVIEW_BYTES).text());
  if (truncated) records.pop();
  const [headers = [], ...rows] = records;
  return { headers: headers.map((h) => h.replace(/^﻿/, "").trim()), rows: rows.slice(0, maxRows) };
}
