"use client";

import { useEffect, useMemo, useState } from "react";

const COLUMNS = [
  "audit_id", "date", "store_id", "store_name", "store_format", "city", "region",
  "auditor_name", "brand", "product_name", "sku_code", "variant", "size_ml",
  "shelf_facings", "total_shelf_facings", "share_of_shelf_pct", "shelf_level",
  "shelf_position", "in_stock", "out_of_stock_duration_days", "shelf_price",
  "promo_price", "on_promotion", "display_type", "planogram_compliant",
  "competitor_brand", "notes",
] as const;

type AuditRow = Record<string, string | number | boolean | null> & { _id: string };
type ApiResponse = {
  rows: AuditRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString();
  }
  return String(value);
}

export default function AuditTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setFilters(draftFilters);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftFilters]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    for (const [field, value] of Object.entries(filters)) {
      if (value.trim()) params.set(`f_${field}`, value.trim());
    }
    return params.toString();
  }, [filters, page, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/audit/records?${queryString}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load audit records.");
        setData(payload as ApiResponse);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [queryString, refreshKey]);

  return (
    <section className="space-y-4 text-black">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Audit records</h2>
          <p className="text-sm">
            {data ? `${data.pagination.total.toLocaleString()} matching records` : "Loading records…"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Rows per page
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={pageSize}
            onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
          >
            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[2200px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column} className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column} className="border-b border-slate-200 p-2">
                  <input
                    aria-label={`Search ${column}`}
                    value={draftFilters[column] ?? ""}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, [column]: event.target.value }))}
                    placeholder="Search…"
                    className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={COLUMNS.length} className="p-8 text-center">Loading…</td></tr>}
            {!loading && data?.rows.length === 0 && <tr><td colSpan={COLUMNS.length} className="p-8 text-center">{Object.values(filters).some((v) => v.trim()) ? "No matching records." : "No records yet. Upload a CSV to get started."}</td></tr>}
            {data?.rows.map((row) => (
              <tr key={row._id} className="odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/50">
                {COLUMNS.map((column) => (
                  <td key={column} className="max-w-72 whitespace-nowrap border-b border-slate-100 px-3 py-2" title={displayValue(row[column])}>
                    <span className={column === "notes" ? "block max-w-72 truncate" : ""}>{displayValue(row[column])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {data && data.pagination.total > 0
            ? `Showing ${((data.pagination.page - 1) * data.pagination.pageSize + 1).toLocaleString()}–${Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total).toLocaleString()} of ${data.pagination.total.toLocaleString()}`
            : "No records to show"}
          {loading ? " · Updating…" : ""}
        </p>
        <div className="flex items-center gap-2">
          <button disabled={!data?.pagination.hasPreviousPage || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
          <span className="min-w-24 text-center text-sm">Page {data?.pagination.page ?? page} of {data?.pagination.totalPages ?? 1}</span>
          <button disabled={!data?.pagination.hasNextPage || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">Next</button>
        </div>
      </div>
    </section>
  );
}
