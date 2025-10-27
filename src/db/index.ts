// src/server/db/index.ts

import * as schema from "./schema";
import * as individualSchema from "./individual/individual-schema";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Kombiniere beide Schemas
const combinedSchema = { ...schema, ...individualSchema };

// ---- Global Singletons für Dev (Hot-Reload sicher) ----
declare global {
  var __drizzleDb:
    | PostgresJsDatabase<typeof combinedSchema>
    | undefined; // nur in Dev
  var __pgClient:
    | ReturnType<typeof postgres>
    | undefined; // nur in Dev
}

// Hinweis: In .d.ts-Dateien wird das nicht zu JS emittiert; hier im Modul ist es OK.
// In Prod greifen wir NICHT auf globalThis zu.

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

let pg: ReturnType<typeof postgres>;
let database: PostgresJsDatabase<typeof combinedSchema>;

if (process.env.NODE_ENV === "production") {
  // frische Instanzen in Prod
  pg = postgres(process.env.DATABASE_URL!);
  database = drizzle(pg, { schema: combinedSchema });
} else {
  // Dev: Wiederverwenden, falls vorhanden (verhindert Connection-Leaks bei HMR)
  if (!globalThis.__pgClient) {
    globalThis.__pgClient = postgres(process.env.DATABASE_URL!);
  }
  if (!globalThis.__drizzleDb) {
    globalThis.__drizzleDb = drizzle(globalThis.__pgClient, { schema: combinedSchema });
  }
  pg = globalThis.__pgClient;
  database = globalThis.__drizzleDb;
}

export { database, pg };