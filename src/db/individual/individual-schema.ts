// INDIVIDUAL SCHEMA
// Add your app-specific database tables here
// This file is NOT synced with the template

import {
    boolean,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    unique,
    numeric,
    jsonb,
    varchar,
    pgSequence,
} from "drizzle-orm/pg-core";


// Example table (remove this in your app):
export const dummyTable = pgTable("gf_dummy", {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    NEUERWERT: numeric("NEUERWERT", { precision: 10, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    data: jsonb("data").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});




// ============================================================================
// TYPES - Export types for use in app and frontend
// ============================================================================

// Example types (remove this in your app):
export type DummyTable = typeof dummyTable.$inferSelect;
export type DummyTableId = typeof dummyTable.$inferSelect['id'];

