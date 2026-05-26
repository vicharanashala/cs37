/**
 * src/lib/mongodb.ts
 *
 * Singleton Mongoose connection for Next.js App Router.
 *
 * Next.js 16 (App Router) runs in a Node.js environment where the module
 * cache persists across hot-reloads in development. We attach the cached
 * promise to `globalThis` so repeated imports don't open multiple connections.
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable in .env.local"
  );
}

/** Shape of the cached connection stored on globalThis */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend the global type so TypeScript doesn't complain
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

// Re-use across hot reloads in development
const cached: MongooseCache = globalThis._mongooseCache ?? {
  conn: null,
  promise: null,
};

globalThis._mongooseCache = cached;

/**
 * Returns a connected Mongoose instance.
 * Safe to call multiple times — returns the same connection.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        // Use the new connection string parser (default in Mongoose 7+)
        // and avoid deprecation warnings.
        serverSelectionTimeoutMS: 10_000,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
