import mongoose from "mongoose";

type Cache = { promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = globalForMongoose.__mongoose ?? { promise: null };
globalForMongoose.__mongoose = cache;

async function dbConnect(): Promise<void> {
    if (mongoose.connection.readyState === 1) return;

    if (!cache.promise) {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGODB_URI is not set");

        cache.promise = mongoose
            .connect(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 })
            .then((m) => {
                console.info("Database connected successfully");
                return m;
            });
    }

    try {
        await cache.promise;
    } catch (error) {
        cache.promise = null;
        process.exit(1);
    }
}

export default dbConnect;
