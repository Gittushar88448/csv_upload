import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface ICsvDataset {
  filename: string;
  columns: string[];
  rowCount: number;
  status: "processing" | "ready" | "failed";
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CsvDatasetSchema = new Schema<ICsvDataset>(
  {
    filename: { type: String, required: true, trim: true },
    columns: { type: [String], default: [] },
    rowCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing",
      index: true,
    },
    errorMessage: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

const CsvDataset: Model<ICsvDataset> =
  (mongoose.models.CsvDataset as Model<ICsvDataset>) ||
  mongoose.model<ICsvDataset>("CsvDataset", CsvDatasetSchema);

export default CsvDataset;
