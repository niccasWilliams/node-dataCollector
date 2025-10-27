
import { desc, relations, sql } from "drizzle-orm";
import { int } from "drizzle-orm/mysql-core";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  varchar,
  json,
  unique,
  date,
  jsonb,
} from "drizzle-orm/pg-core";

export const appSettingsTypeEnum = pgEnum("app_settings_type", ["string", "number", "boolean", "json"]);
export const webhookStatusEnum = pgEnum("webhook_status", ["pending", "processed", "failed", "skipped"]);
export const appLogLevelEnum = pgEnum("app_log_level", ["info", "warn", "error", "debug", "fatal", "critical"]);
export const roleAssignmentStatusEnum = pgEnum("role_assignment_status", ["active", "expired", "revoked"]);





export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  externalUserId: text("external_user_id"),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at"),
})

export const userActivities = pgTable("user_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  activityDate: date("activity_date").notNull(), // Date of activity (YYYY-MM-DD)
  firstActivityAt: timestamp("first_activity_at").notNull(), // First request of the day
  lastActivityAt: timestamp("last_activity_at").notNull(), // Last request of the day (updated continuously)
  requestCount: integer("request_count").notNull().default(0), // Total requests this day
  requests: jsonb("requests").notNull().default([]), // Array of request details (max 50, FIFO)
  createdAt: timestamp("created_at").notNull(), // When this daily record was created
  updatedAt: timestamp("updated_at").notNull(), // When this daily record was last updated
}, (table) => ({
  userIdx: index("user_activity_user_idx").on(table.userId),
  activityDateIdx: index("user_activity_date_idx").on(table.activityDate),
  userDateIdx: index("user_activity_user_date_idx").on(table.userId, table.activityDate),
  // Unique constraint: one entry per user per day
  uniqueUserDate: unique("user_activity_unique_user_date").on(table.userId, table.activityDate),
}))






export const appLogs = pgTable("app_logs", {
  id: serial("id").primaryKey(),
  level: appLogLevelEnum("level").notNull(),
  message: text("message").notNull(),
  context: jsonb("context").default({}),
  createdAt: timestamp("created_at").notNull(),
}, (table) => ({
  levelIdx: index("app_log_level_idx").on(table.level),
  createdAtIdx: index("app_log_created_at_idx").on(table.createdAt),
}));


//WEBHOOKS ############################################################################################################
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // z. B. "Stripe", "PayPal", "Printful"
  eventType: text("event_type").notNull(),
  externalId: text("external_id").notNull(),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  status: webhookStatusEnum("status").notNull().default("pending"),
  processMessage: text("process_message"),
  originUrl: text("origin_url"),
  createdAt: timestamp("created_at").notNull(),
  processedAt: timestamp("processed_at"),
  userAgent: text("user_agent"), // User-Agent Header
  signature: text("signature"), // Webhook signature für Verifizierung
  retryCount: integer("retry_count").notNull().default(0), // Anzahl der Retry-Versuche
  lastRetryAt: timestamp("last_retry_at"), // Letzter Retry-Versuch
}, (table) => ({
  externalIdIdx: index("webhook_external_id_idx").on(table.externalId),
  providerEventIdx: index("webhook_provider_event_idx").on(table.provider, table.eventType),
}));



//ROLES ############################################################################################################
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
}, (table) => ({
  uniqueName: unique("unique_permission_name").on(table.name),
}));

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  permissionId: integer("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
  assignedBy: integer("assigned_by").references(() => users.id, { onDelete: "set null" }).notNull(),
  revokedBy: integer("revoked_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull(),
  validTo: timestamp("valid_to"),
}, (table) => ({
  roleIdx: index("role_permission_role_idx").on(table.roleId),
  permissionIdx: index("role_permission_permission_idx").on(table.permissionId),
}));


export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull(),
});

export const roleAssignments = pgTable("role_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: roleAssignmentStatusEnum("status").notNull(),
  roleId: integer("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  assignedBy: integer("assigned_by").references(() => users.id, { onDelete: "set null" }).notNull(),
  revokedBy: integer("revoked_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull(),
}, (table) => ({
  userIdx: index("role_assignment_user_idx").on(table.userId),
  roleIdx: index("role_assignment_role_idx").on(table.roleId),
}));



export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: varchar("value").notNull(),
  type: appSettingsTypeEnum("type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull(),
}, (table) => ({
  keyIdx: index("app_settings_key_idx").on(table.key),
}));






/**
 * TYPES
 *
 * You can create and export types from your schema to use in your application.
 * This is useful when you need to know the shape of the data you are working with
 * in a component or function.
 */

export type User = typeof users.$inferInsert;
export type UserId = typeof users.$inferSelect['id'];
export type UserActivity = typeof userActivities.$inferInsert;
export type UserActivityId = typeof userActivities.$inferSelect['id'];
export type AppSettings = typeof appSettings.$inferInsert;
export type AppSettingsId = typeof appSettings.$inferSelect['id'];
export type AppSettingsType = typeof appSettingsTypeEnum.enumValues[number];



export type AppLog = typeof appLogs.$inferSelect;


export type Webhook = typeof webhooks.$inferSelect;
export type WebhookStatus = typeof webhookStatusEnum.enumValues[number];
export type WebhookId = typeof webhooks.$inferSelect['id'];




export type Permission = typeof permissions.$inferSelect;
export type PermissionId = typeof permissions.$inferSelect["id"];
export type Role = typeof roles.$inferSelect;
export type RoleId = typeof roles.$inferSelect["id"];
export type RolePermission = typeof rolePermissions.$inferSelect;
export type RolePermissionId = typeof rolePermissions.$inferSelect["id"];
export type RoleAssignment = typeof roleAssignments.$inferSelect;
export type RoleAssignmentId = typeof roleAssignments.$inferSelect["id"];
export type RoleAssignmentStatus = typeof roleAssignmentStatusEnum.enumValues[number];


















