import ConnectDB from "@/lib/mongoClient";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

export async function GET() {
  const client = await ConnectDB();
  const db = client.db(DB_NAME);

  const searches = await db
    .collection("search_analytics")
    .find({})
    .sort({ count: -1 })
    .limit(8)
    .toArray();

  return Response.json(
    searches.map((s) => ({
      query: s.query,
      count: s.count,
    }))
  );
}