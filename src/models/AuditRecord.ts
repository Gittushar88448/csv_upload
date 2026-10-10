import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface IAuditRecord {
  uploadId: Types.ObjectId;
  audit_id: string;
  date: Date | null;
  store_id: string;
  store_name: string;
  store_format: string;
  city: string;
  region: string;
  auditor_name: string;
  brand: string;
  product_name: string;
  sku_code: string;
  variant: string;
  size_ml: number | null;
  shelf_facings: number | null;
  total_shelf_facings: number | null;
  share_of_shelf_pct: number | null;
  shelf_level: string;
  shelf_position: string;
  in_stock: boolean | null;
  out_of_stock_duration_days: number | null;
  shelf_price: number | null;
  promo_price: number | null;
  on_promotion: boolean | null;
  display_type: string;
  planogram_compliant: boolean | null;
  competitor_brand: string;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuditRecordSchema = new Schema<IAuditRecord>(
  {
    uploadId: { type: Schema.Types.ObjectId, required: true, index: true },
    audit_id: { type: String, required: true, trim: true },
    date: { type: Date, default: null },
    store_id: { type: String, default: "", trim: true },
    store_name: { type: String, default: "", trim: true },
    store_format: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    region: { type: String, default: "", trim: true },
    auditor_name: { type: String, default: "", trim: true },
    brand: { type: String, default: "", trim: true },
    product_name: { type: String, default: "", trim: true },
    sku_code: { type: String, default: "", trim: true },
    variant: { type: String, default: "", trim: true },
    size_ml: { type: Number, default: null },
    shelf_facings: { type: Number, default: null },
    total_shelf_facings: { type: Number, default: null },
    share_of_shelf_pct: { type: Number, default: null },
    shelf_level: { type: String, default: "", trim: true },
    shelf_position: { type: String, default: "", trim: true },
    in_stock: { type: Boolean, default: null },
    out_of_stock_duration_days: { type: Number, default: null },
    shelf_price: { type: Number, default: null },
    promo_price: { type: Number, default: null },
    on_promotion: { type: Boolean, default: null },
    display_type: { type: String, default: "", trim: true },
    planogram_compliant: { type: Boolean, default: null },
    competitor_brand: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

AuditRecordSchema.index({ audit_id: 1 });
AuditRecordSchema.index({ date: -1, audit_id: 1 });
AuditRecordSchema.index({ store_id: 1 });
AuditRecordSchema.index({ sku_code: 1 });
AuditRecordSchema.index({ brand: 1 });

const AuditRecord: Model<IAuditRecord> =
  (mongoose.models.AuditRecord as Model<IAuditRecord>) ||
  mongoose.model<IAuditRecord>("AuditRecord", AuditRecordSchema);

export default AuditRecord;
