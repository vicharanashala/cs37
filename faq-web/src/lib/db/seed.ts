/**
 * src/lib/db/seed.ts
 *
 * One-shot seed script — imports static faqData.ts and inserts every
 * Category and FAQ document into MongoDB (faqs + categories collections).
 *
 * Run with:
 *   npm run db:seed
 *
 * Safe to re-run: uses insertMany with { ordered: false } so duplicate
 * key errors on re-runs are silently skipped.
 */

import "dotenv/config";
import ConnectDB from "@/lib/mongoClient";
import { faqData, categories } from "../../data/faqData";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

async function seed() {
  console.log("🌱  Connecting to MongoDB…");
  const client = await ConnectDB();
  console.log("✅  Connected.");

  const db = client.db(DB_NAME);

  console.log(`\n📂  Seeding ${categories.length} categories…`);
  try {
    const catResult = await db.collection("categories").insertMany(categories, {
      ordered: false,
    });
    console.log(`   ✅  ${catResult.insertedCount} categories inserted.`);
  } catch (err: any) {
    if (err.code === 11000) {
      console.log("   ⚠️  Some categories already exist, skipping duplicates.");
    } else {
      throw err;
    }
  }

  console.log(`\n📝  Seeding ${faqData.length} FAQs…`);
  try {
    const faqsWithPublished = faqData.map((faq) => ({ ...faq, isPublished: true }));
    const faqResult = await db.collection("faqs").insertMany(faqsWithPublished, {
      ordered: false,
    });
    console.log(`   ✅  ${faqResult.insertedCount} FAQs inserted.`);
  } catch (err: any) {
    if (err.code === 11000) {
      console.log("   ⚠️  Some FAQs already exist, skipping duplicates.");
    } else {
      throw err;
    }
  }

  await client.close();
  console.log("\n🎉  Seed complete. MongoDB disconnected.");
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});