import type { NextRequest } from "next/server";
import ConnectDB from "@/lib/mongoClient";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query?.trim()) {
    return Response.json({ success: false });
  }

  const client = await ConnectDB();
  const db = client.db(DB_NAME);

  await db.collection("search_analytics").updateOne(
    { query: query.trim() },
    {
      $inc: { count: 1 },
      $set: { updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  return Response.json({ success: true });
}