import ConnectDB from "../lib/mongoClient";
import { faqData } from "../data/faqData";

async function main() {
  const client = await ConnectDB();
  const db = client.db("RAG_Project");

  const result = await db.collection("data").insertMany(faqData);
  console.log(`Seeded ${result.insertedCount} documents.`);

  await client.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});