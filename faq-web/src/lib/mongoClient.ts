/**
 * src/lib/mongoClient.ts
 *
 * Native MongoDB driver singleton for Next.js App Router.
 *
 * Exports a `clientPromise` (Promise<MongoClient>) that resolves to a
 * connected client. Use this when you want to call the MongoDB driver API
 * directly — e.g. collection.insertOne(), collection.find() — without
 * going through Mongoose.
 *
 * Usage in a Route Handler:
 *   import clientPromise from "@/lib/mongoClient";
 *   const client = await clientPromise;
 *   const db = client.db(process.env.MONGODB_DB ?? "samagama");
 *   await db.collection("pending_questions").insertOne({ ... });
 *
 * The singleton is attached to `globalThis` so Next.js hot-reloads in
 * development do not open a new connection on every module re-evaluation.
 */
import { MongoClient, ServerApiVersion } from 'mongodb';

// Replace the placeholder with your Atlas connection string
const uri = 'mongodb+srv://admin:lordTejashvi7@cluster0.6sd2h.mongodb.net/?appName=Cluster0';

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client: MongoClient = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db: MongoClient | undefined; // available even outside function scope

export default async function ConnectDB(): Promise<MongoClient> {
  if (!db) {
    try {
      db = await client.connect();
      console.log('Connected to MongoDB!');
    } catch (err) {
      throw new Error('Cant connect to database');
    }
  }
  return db!;
}

