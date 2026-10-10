import type { Types } from "mongoose";

export const AUDIT_HEADERS = [
  "audit_id",
  "date",
  "store_id",
  "store_name",
  "store_format",
  "city",
  "region",
  "auditor_name",
  "brand",
  "product_name",
  "sku_code",
  "variant",
  "size_ml",
  "shelf_facings",
  "total_shelf_facings",
  "share_of_shelf_pct",
  "shelf_level",
  "shelf_position",
  "in_stock",
  "out_of_stock_duration_days",
  "shelf_price",
  "promo_price",
  "on_promotion",
  "display_type",
  "planogram_compliant",
  "competitor_brand",
  "notes",
] as const;

export type AuditCsvRow = Record<string, string>;

export function parseNumber(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const normalized = String(value).trim().replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function parseBoolean(value: unknown): boolean | null {
  if (value == null || String(value).trim() === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "in stock", "compliant"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "out of stock", "non-compliant", "non compliant"].includes(normalized)) return false;
  return null;
}

export function parseCsvDate(value: unknown): Date | null {
  if (value == null || String(value).trim() === "") return null;
  const input = String(value).trim();

  const isoLike = /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(input);
  if (isoLike) {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmy = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return null;
    return date;
  }

  const fallback = new Date(input);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function mapCsvRow(row: AuditCsvRow, uploadId: Types.ObjectId) {
  return {
    uploadId,
    audit_id: row.audit_id?.trim() ?? "",
    date: parseCsvDate(row.date),
    store_id: row.store_id?.trim() ?? "",
    store_name: row.store_name?.trim() ?? "",
    store_format: row.store_format?.trim() ?? "",
    city: row.city?.trim() ?? "",
    region: row.region?.trim() ?? "",
    auditor_name: row.auditor_name?.trim() ?? "",
    brand: row.brand?.trim() ?? "",
    product_name: row.product_name?.trim() ?? "",
    sku_code: row.sku_code?.trim() ?? "",
    variant: row.variant?.trim() ?? "",
    size_ml: parseNumber(row.size_ml),
    shelf_facings: parseNumber(row.shelf_facings),
    total_shelf_facings: parseNumber(row.total_shelf_facings),
    share_of_shelf_pct: parseNumber(row.share_of_shelf_pct),
    shelf_level: row.shelf_level?.trim() ?? "",
    shelf_position: row.shelf_position?.trim() ?? "",
    in_stock: parseBoolean(row.in_stock),
    out_of_stock_duration_days: parseNumber(row.out_of_stock_duration_days),
    shelf_price: parseNumber(row.shelf_price),
    promo_price: parseNumber(row.promo_price),
    on_promotion: parseBoolean(row.on_promotion),
    display_type: row.display_type?.trim() ?? "",
    planogram_compliant: parseBoolean(row.planogram_compliant),
    competitor_brand: row.competitor_brand?.trim() ?? "",
    notes: row.notes?.trim() ?? "",
  };
}
