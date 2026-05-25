/**
 * src/lib/db/seed.ts
 *
 * One-shot seed script — imports the static faqData.ts and upserts every
 * Category and FAQ document into MongoDB.
 *
 * Run with:
 *   npx tsx src/lib/db/seed.ts
 *
 * Safe to re-run: uses upsert (updateOne + upsert:true) so it won't
 * create duplicates.
 */

import "dotenv/config"; // reads .env.local automatically via dotenv
import mongoose from "mongoose";
import { faqData, categories } from "../../data/faqData";
import Category from "../../models/Category";
import FAQ from "../../models/FAQ";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI is not set. Add it to .env.local");
  process.exit(1);
}

async function seed() {
  console.log("🌱  Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI!, { serverSelectionTimeoutMS: 10_000 });
  console.log("✅  Connected.");

  // ── Seed Categories ──────────────────────────────────────────────────────
  console.log(`\n📂  Seeding ${categories.length} categories…`);
  for (const cat of categories) {
    await Category.updateOne(
      { categoryId: cat.id },
      {
        $set: {
          categoryId: cat.id,
          name: cat.name,
          icon: cat.icon,
          description: cat.description,
          count: cat.count,
        },
      },
      { upsert: true }
    );
  }
  console.log("✅  Categories done.");

  // ── Seed FAQs ────────────────────────────────────────────────────────────
  console.log(`\n📝  Seeding ${faqData.length} FAQs…`);
  for (const faq of faqData) {
    await FAQ.updateOne(
      { faqId: faq.id },
      {
        $set: {
          faqId: faq.id,
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          categoryId: faq.categoryId,
          tags: faq.tags,
          helpful: faq.helpful,
          notHelpful: faq.notHelpful,
          lastUpdated: faq.lastUpdated,
          isPublished: true,
        },
      },
      { upsert: true }
    );
  }
  console.log("✅  FAQs done.");

  await mongoose.disconnect();
  console.log("\n🎉  Seed complete. MongoDB disconnected.");
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
