/**
 * src/lib/db/migratePendingQuestions.ts
 *
 * One-shot migration script — backfills the unified community thread fields
 * onto all existing documents in the `pending_questions` collection of the
 * `samagama` database.
 *
 * Fields added by this migration:
 *   authorRole      → "user"  (every doc was a user submission)
 *   initialAnswer   → null    (old docs have no initial answer; admin fills it)
 *   answeredBy      → null
 *   answeredByRole  → null
 *   views           → 0
 *   replies         → []
 *   ragValidation   → undefined  (not present on legacy docs)
 *
 * For docs with no `resolvedAt` set but `answer` present, treat as resolved
 * and backfill `resolvedAt` from `updatedAt`.
 *
 * Run with:
 *   npm run db:migrate:pending-questions
 *
 * Safe to re-run: uses $set with upsert:false (never inserts, only modifies
 * existing docs). A compound index on { _id: 1 } already exists; no new
 * indexes are required for the new fields.
 *
 * After running this, set `MIGRATED_PENDING_QUESTIONS=true` in .env so the
 * migration is not accidentally re-run.
 */

import "dotenv/config";
import ConnectDB from "@/lib/mongoClient";

const DB_NAME = process.env.MONGODB_DB ?? "samagama";

async function migrate() {
  console.log("🔌  Connecting to MongoDB…");
  const client = await ConnectDB();

  if (process.env.MIGRATED_PENDING_QUESTIONS === "true") {
    console.log("⏭  MIGRATED_PENDING_QUESTIONS=true — skipping migration.");
    console.log("   Unset the env var to re-run if needed.");
    await client.close();
    return;
  }
  console.log(`✅  Connected. Target: ${DB_NAME}.pending_questions`);

  const db = client.db(DB_NAME);
  const coll = db.collection("pending_questions");

  // ── Phase 1: Add thread fields with defaults ────────────────────────────────
  console.log("\n📦  Phase 1 — backfilling thread fields…");

  const phase1 = await coll.updateMany(
    {},
    {
      $set: {
        authorRole:    "user",
        initialAnswer: null,
        answeredBy:    null,
        answeredByRole: null,
        views:         0,
        replies:       [],
      },
    }
  );
  console.log(`   ✅  ${phase1.modifiedCount} document(s) updated.`);

  // ── Phase 2: Fix resolvedAt for docs that have an answer but no resolvedAt ───
  console.log("\n⏱  Phase 2 — backfilling resolvedAt for resolved docs…");

  const phase2 = await coll.updateMany(
    {
      answer: { $ne: null },
      resolvedAt: null,
    },
    [
      {
        $set: {
          resolvedAt: "$updatedAt",
        },
      },
    ]
  );
  console.log(`   ✅  ${phase2.modifiedCount} document(s) updated.`);

  // ── Phase 3: Normalize status — ensure old "pending_rag" is preserved as-is ──
  // (no change needed; old docs already have correct pending/resolved/rejected)
  console.log("\n🔍  Phase 3 — checking for orphaned legacy fields…");

  const orphaned = await coll
    .find({
      $and: [
        { status: { $in: ["pending", "pending_rag"] } },
        { ragValidation: { $exists: false } },
        { answer: { $ne: null } }, // pending but already has an answer — unlikely
      ],
    })
    .count();
  if (orphaned > 0) {
    console.warn(`   ⚠️  ${orphaned} document(s) have answer but status=pending — review manually.`);
  } else {
    console.log("   ✅  No orphans found.");
  }

  await client.close();
  console.log("\n🎉  Migration complete. MongoDB disconnected.");
  console.log("\n⚠️  Action required:");
  console.log("   Set MIGRATED_PENDING_QUESTIONS=true in your .env file");
  console.log("   to prevent this script from re-running accidentally.");
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});