"use client";

import { useRef, useState } from "react";
import AuditTable from "@/components/audit/AuditTable";
import { AUDIT_HEADERS } from "@/lib/audit/csvMapper";
import { readCsvPreview, type CsvPreview } from "@/lib/audit/csvPreview";

export default function AuditExplorer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filename, setFilename] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);

  const normalizedHeaders = preview?.headers.map((header) => header.toLowerCase()) ?? [];
  const missingHeaders = preview ? AUDIT_HEADERS.filter((header) => !normalizedHeaders.includes(header)) : [];
  const extraHeaders = preview?.headers.filter((header) => !(AUDIT_HEADERS as readonly string[]).includes(header.toLowerCase())) ?? [];
  const headersOk = !!preview && missingHeaders.length === 0 && extraHeaders.length === 0;


  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPreview(null);
    setError("");
    setMessage("");
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      return;
    }
    try {
      const result = await readCsvPreview(file);
      if (!result.headers.length) throw new Error("The CSV file looks empty.");
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the CSV file.");
    }
  }

  function cancelPreview() {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    setProgressNote("Uploading and importing the CSV. Large files may take a while; keep this page open.");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/audit/upload", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "CSV import failed.");
      setRefreshKey((key) => key + 1);
      setFilename(payload.filename);
      setMessage(`Imported ${Number(payload.rowCount).toLocaleString()} records successfully.`);
      setProgressNote("");
      cancelPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV import failed.");
      setProgressNote("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-black px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Data workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Audit CSV Explorer</h1>
          <p className="mt-2 max-w-3xl">Import store and shelf audit data, then filter records by any column.</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <form id="audit-upload-form" onSubmit={handleUpload} className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="audit-csv" className="mb-2 block text-sm font-semibold">CSV file</label>
              <input ref={inputRef} id="audit-csv" type="file" accept=".csv,text/csv" disabled={uploading} onChange={handleFileChange} className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-medium file:text-black hover:file:bg-slate-200 disabled:opacity-50" />
              <p className="mt-2 text-xs">Expected columns: audit_id, date, store_id, store_name, store_format, city, region, auditor_name, brand, product_name, sku_code, variant, size_ml, shelf_facings, total_shelf_facings, share_of_shelf_pct, shelf_level, shelf_position, in_stock, out_of_stock_duration_days, shelf_price, promo_price, on_promotion, display_type, planogram_compliant, competitor_brand, notes.</p>
            </div>
          </form>

          {!preview && progressNote && <p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{progressNote}</p>}
          {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message} {filename && <span className="font-medium">({filename})</span>}</p>}
          {!preview && error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </section>

        <AuditTable refreshKey={refreshKey} />
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col gap-4 rounded-2xl bg-white p-5 text-black shadow-xl sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="preview-title" className="text-lg font-semibold">Preview CSV</h2>
                <p className="text-sm">{inputRef.current?.files?.[0]?.name} · first {preview.rows.length} rows</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={cancelPreview} disabled={uploading} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium disabled:opacity-50">Cancel</button>
                <button type="submit" form="audit-upload-form" disabled={uploading || !headersOk} className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {uploading ? "Importing CSV…" : "Confirm and import"}
                </button>
              </div>
            </div>
            {!headersOk && (
              <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Headers don&apos;t match the audit format. Missing: {missingHeaders.join(", ") || "none"}. Unexpected: {extraHeaders.join(", ") || "none"}.
              </p>
            )}
            {progressNote && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{progressNote}</p>}
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="min-h-0 overflow-auto rounded-xl border border-slate-200">
              <table className="border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>{preview.headers.map((header, i) => <th key={i} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, r) => (
                    <tr key={r} className="odd:bg-white even:bg-slate-50/60">
                      {preview.headers.map((_, c) => <td key={c} className="max-w-60 truncate whitespace-nowrap border-b border-slate-100 px-3 py-2">{row[c] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
