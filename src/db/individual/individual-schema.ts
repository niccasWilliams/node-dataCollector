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
import { users } from "../schema";

export const browserSessionStatusEnum = pgEnum("browser_session_status", ["idle", "active", "navigating", "closed"]);
export const browserActivityTypeEnum = pgEnum("browser_activity_type", ["navigation", "screenshot", "interaction", "script", "extraction"]);



//BROWSER AUTOMATION ############################################################################################################
export const browserSessions = pgTable("browser_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(), // Unique session identifier (browser-{timestamp}-{random})
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }), // Optional: track which user created the session
  status: browserSessionStatusEnum("status").notNull().default("idle"),
  currentUrl: text("current_url"),
  title: text("title"),
  config: jsonb("config").notNull().default({}), // Browser configuration (headless, viewport, etc.)
  metadata: jsonb("metadata").default({}), // Custom metadata
  createdAt: timestamp("created_at").notNull(),
  lastActivityAt: timestamp("last_activity_at").notNull(),
  closedAt: timestamp("closed_at"),
}, (table) => ({
  sessionIdIdx: index("browser_session_id_idx").on(table.sessionId),
  statusIdx: index("browser_session_status_idx").on(table.status),
  userIdx: index("browser_session_user_idx").on(table.userId),
}));

export const browserActivities = pgTable("browser_activities", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => browserSessions.sessionId, { onDelete: "cascade" }),
  type: browserActivityTypeEnum("type").notNull(),
  action: text("action").notNull(), // e.g., "navigate", "click", "screenshot"
  target: text("target"), // URL, selector, etc.
  value: text("value"), // Input value, script, etc.
  metadata: jsonb("metadata").default({}), // Additional data (screenshot path, extracted data, etc.)
  success: boolean("success").notNull().default(true),
  error: text("error"), // Error message if failed
  duration: integer("duration"), // Duration in milliseconds
  timestamp: timestamp("timestamp").notNull(),
}, (table) => ({
  sessionIdIdx: index("browser_activity_session_idx").on(table.sessionId),
  typeIdx: index("browser_activity_type_idx").on(table.type),
  timestampIdx: index("browser_activity_timestamp_idx").on(table.timestamp),
}));

export const browserScreenshots = pgTable("browser_screenshots", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => browserSessions.sessionId, { onDelete: "cascade" }),
  activityId: integer("activity_id").references(() => browserActivities.id, { onDelete: "cascade" }),
  url: text("url").notNull(), // URL when screenshot was taken
  title: text("title"),
  path: text("path").notNull(), // File path where screenshot is stored
  fullPage: boolean("full_page").notNull().default(false),
  width: integer("width"),
  height: integer("height"),
  size: integer("size"), // File size in bytes
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull(),
}, (table) => ({
  sessionIdIdx: index("browser_screenshot_session_idx").on(table.sessionId),
  pathIdx: index("browser_screenshot_path_idx").on(table.path),
}));

export const browserExtractedData = pgTable("browser_extracted_data", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => browserSessions.sessionId, { onDelete: "cascade" }),
  activityId: integer("activity_id").references(() => browserActivities.id, { onDelete: "cascade" }),
  url: text("url").notNull(), // URL where data was extracted
  dataType: text("data_type").notNull(), // e.g., "onlogist_routes", "product_info", "table_data"
  data: jsonb("data").notNull(), // The extracted data
  schema: jsonb("schema"), // Optional: data schema/structure definition
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull(),
}, (table) => ({
  sessionIdIdx: index("browser_extracted_data_session_idx").on(table.sessionId),
  dataTypeIdx: index("browser_extracted_data_type_idx").on(table.dataType),
  urlIdx: index("browser_extracted_data_url_idx").on(table.url),
  createdAtIdx: index("browser_extracted_data_created_idx").on(table.createdAt),
}));





// ============================================================================
// TYPES - Export types for use in app and frontend
// ============================================================================

export type BrowserSession = typeof browserSessions.$inferSelect;
export type BrowserSessionInsert = typeof browserSessions.$inferInsert;
export type BrowserSessionId = typeof browserSessions.$inferSelect["id"];
export type BrowserSessionStatus = typeof browserSessionStatusEnum.enumValues[number];

export type BrowserActivity = typeof browserActivities.$inferSelect;
export type BrowserActivityInsert = typeof browserActivities.$inferInsert;
export type BrowserActivityId = typeof browserActivities.$inferSelect["id"];
export type BrowserActivityType = typeof browserActivityTypeEnum.enumValues[number];

export type BrowserScreenshot = typeof browserScreenshots.$inferSelect;
export type BrowserScreenshotInsert = typeof browserScreenshots.$inferInsert;
export type BrowserScreenshotId = typeof browserScreenshots.$inferSelect["id"];

export type BrowserExtractedData = typeof browserExtractedData.$inferSelect;
export type BrowserExtractedDataInsert = typeof browserExtractedData.$inferInsert;
export type BrowserExtractedDataId = typeof browserExtractedData.$inferSelect["id"];




