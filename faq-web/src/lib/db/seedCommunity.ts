/**
 * src/lib/db/seedCommunity.ts
 *
 * One-shot seed script — imports static threadsData.ts and inserts every
 * community Thread (question + initial answer + nested replies) into the
 * `community` collection of the `samagama` database.
 *
 * The full Thread shape is preserved, including the `replies: Reply[]` array,
 * which is stored as a nested JSON array on each document — so every question
 * keeps its reply chain in the database.
 *
 * Each document carries a deterministic `_id` taken from the thread's own id
 * ("thread-1", …). The collection is wiped before insert so re-runs produce a
 * clean state that exactly mirrors threadsData.ts.
 *
 * Run with:
 *   npm run db:seed:community
 */

import "dotenv/config";
import type { Document } from "mongodb";
import ConnectDB from "@/lib/mongoClient";
import { threadsData } from "../../data/threadsData";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";
const COLLECTION = "community";

async function seed() {
  console.log("🌱  Connecting to MongoDB…");
  const client = await ConnectDB();
  console.log(`✅  Connected. Target: ${DB_NAME}.${COLLECTION}`);

  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION);

  // Clean slate: remove any previous contents so the collection mirrors
  // threadsData.ts exactly (this also clears the earlier faqData rows).
  const { deletedCount } = await collection.deleteMany({});
  console.log(`\n🧹  Cleared ${deletedCount} existing document(s).`);

  // Deterministic _id from each thread's id; replies stay nested as JSON.
  const docs = threadsData.map((thread) => ({ _id: thread.id, ...thread })) as Document[];

  console.log(`\n📝  Seeding ${docs.length} community threads (with replies)…`);
  const result = await collection.insertMany(docs, { ordered: false });
  console.log(`   ✅  ${result.insertedCount} document(s) inserted.`);

  const totalReplies = threadsData.reduce((n, t) => n + t.replies.length, 0);
  console.log(`   💬  ${totalReplies} replies embedded across all threads.`);

  const total = await collection.countDocuments();
  console.log(`   📊  ${COLLECTION} now holds ${total} document(s).`);

  await client.close();
  console.log("\n🎉  Seed complete. MongoDB disconnected.");
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
