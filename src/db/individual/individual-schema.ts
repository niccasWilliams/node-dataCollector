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
import { sql } from "drizzle-orm";
import { users } from "../schema";

// Browser Enums
export const browserSessionStatusEnum = pgEnum("browser_session_status", ["idle", "active", "navigating", "closed"]);
export const browserActivityTypeEnum = pgEnum("browser_activity_type", ["navigation", "screenshot", "interaction", "script", "extraction"]);

// Website Workflow Enums
export const websiteWorkflowTypeEnum = pgEnum("website_workflow_type", [
  "price_check",     // Check product price
  "data_extraction", // Extract structured data
  "form_fill",       // Fill and submit forms
  "monitoring",      // Monitor for changes
  "scraping",        // General scraping
  "testing",         // UI testing
  "custom",          // Custom workflow
]);

export const websiteWorkflowStatusEnum = pgEnum("website_workflow_status", [
  "active",
  "paused",
  "disabled",
  "error",
]);

export const websiteWorkflowRunStatusEnum = pgEnum("website_workflow_run_status", [
  "pending",
  "running",
  "success",
  "failed",
  "timeout",
  "cancelled",
]);

// Product & Price Tracking Enums
export const productAvailabilityEnum = pgEnum("product_availability", [
  "in_stock",
  "out_of_stock",
  "limited_stock",
  "preorder",
  "discontinued",
  "unknown",
]);

export const priceAlertTypeEnum = pgEnum("price_alert_type", [
  "below_price",       // Price dropped below threshold
  "percentage_drop",   // Price dropped by X%
  "back_in_stock",     // Product came back in stock
  "price_error",       // Suspicious price (too low)
]);

export const priceAlertStatusEnum = pgEnum("price_alert_status", [
  "active",
  "triggered",
  "expired",
  "disabled",
]);

export const productMatchStatusEnum = pgEnum("product_match_status", [
  "pending",       // Waiting for review
  "accepted",      // User confirmed it's the same product
  "rejected",      // User confirmed it's NOT the same product
  "auto_merged",   // Automatically merged (high confidence)
]);

export const productAttributeTypeEnum = pgEnum("product_attribute_type", [
  "screen_size",    // TV/Monitor: "55 Zoll", "65 inches"
  "storage",        // Phone/Laptop: "256GB", "512GB"
  "memory",         // RAM: "16GB", "32GB"
  "color",          // "Schwarz", "Weiß", "Space Gray"
  "resolution",     // "4K", "Full HD", "1080p"
  "processor",      // "Intel i7", "Apple M2"
  "weight",         // "2.5kg", "500g"
  "dimensions",     // "50x30x5cm"
  "connectivity",   // "WiFi 6", "Bluetooth 5.0"
  "custom",         // Other attributes
]);



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



// WEBSITE INVENTORY & AUTOMATION ############################################################################################################

/**
 * Websites Table - Domain Level
 * Stores only the base domain (e.g., amazon.de, ebay.com)
 */
export const websites = pgTable("websites", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(), // e.g., "amazon.de", "ebay.com"
  name: text("name"), // Friendly name, e.g., "Amazon Deutschland"
  description: text("description"),
  metadata: jsonb("metadata").default({}), // Custom metadata (site config, API keys, etc.)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  domainIdx: index("website_domain_idx").on(table.domain),
  isActiveIdx: index("website_is_active_idx").on(table.isActive),
}));

/**
 * Website Pages Table - URL/Path Level
 * Stores specific URLs/paths for each website domain
 */
export const websitePages = pgTable("website_pages", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  url: text("url").notNull().unique(), // Full URL: https://amazon.de/dp/B08N5WRWNW
  path: text("path").notNull(), // Path only: /dp/B08N5WRWNW
  title: text("title"),
  description: text("description"),
  contentHash: text("content_hash"), // Hash of page content (detect changes)
  htmlSnapshot: text("html_snapshot"), // Optional: Store HTML for analysis
  metadata: jsonb("metadata").default({}),
  lastScannedAt: timestamp("last_scanned_at"),
  scanCount: integer("scan_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  websiteIdx: index("website_page_website_idx").on(table.websiteId),
  urlIdx: index("website_page_url_idx").on(table.url),
  pathIdx: index("website_page_path_idx").on(table.path),
  websiteDomainPathIdx: index("website_page_domain_path_idx").on(table.websiteId, table.path),
  lastScannedIdx: index("website_page_last_scanned_idx").on(table.lastScannedAt),
}));

/**
 * Website Elements Table - Page Elements
 * Stores interactive elements found on a page
 */
export const websiteElements = pgTable("website_elements", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => websitePages.id, { onDelete: "cascade" }),
  tagName: varchar("tag_name", { length: 100 }).notNull(),
  cssSelector: text("css_selector").notNull(),
  attributes: jsonb("attributes").notNull().default({}),
  classes: jsonb("classes").notNull().default([]),
  textContent: text("text_content"),
  nameAttr: text("name"),
  href: text("href"),
  typeAttr: text("type"),
  role: text("role"),
  formAction: text("form_action"),
  visible: boolean("visible").notNull().default(false),
  disabled: boolean("disabled").notNull().default(false),
  boundingBox: jsonb("bounding_box"), // {x, y, width, height}
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pageIdx: index("website_element_page_idx").on(table.pageId),
  selectorIdx: index("website_element_selector_idx").on(table.cssSelector),
  tagIdx: index("website_element_tag_idx").on(table.tagName),
  visibleIdx: index("website_element_visible_idx").on(table.visible),
}));

/**
 * Website Workflows Table - Automation Tasks
 * Defines what actions to perform on specific pages
 * Examples: "Check Amazon Price", "Scrape Product Info", "Monitor Stock"
 */
export const websiteWorkflows = pgTable("website_workflows", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  pageId: integer("page_id").references(() => websitePages.id, { onDelete: "cascade" }), // Optional: specific page
  name: text("name").notNull(), // e.g., "Amazon Product Price Monitor"
  description: text("description"),
  type: websiteWorkflowTypeEnum("type").notNull(),
  status: websiteWorkflowStatusEnum("status").notNull().default("active"),

  // Workflow Configuration
  config: jsonb("config").notNull().default({}), // Workflow-specific config
  selectors: jsonb("selectors").default({}), // CSS selectors for elements
  schedule: text("schedule"), // Cron expression for scheduled runs

  // Execution Settings
  retryCount: integer("retry_count").notNull().default(3),
  timeout: integer("timeout").notNull().default(30000), // milliseconds

  // Statistics
  runCount: integer("run_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  lastRunAt: timestamp("last_run_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastFailureAt: timestamp("last_failure_at"),

  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  websiteIdx: index("website_workflow_website_idx").on(table.websiteId),
  pageIdx: index("website_workflow_page_idx").on(table.pageId),
  typeIdx: index("website_workflow_type_idx").on(table.type),
  statusIdx: index("website_workflow_status_idx").on(table.status),
  scheduleIdx: index("website_workflow_schedule_idx").on(table.schedule),
}));

/**
 * Website Workflow Runs Table - Execution History
 * Tracks every execution of a workflow
 */
export const websiteWorkflowRuns = pgTable("website_workflow_runs", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => websiteWorkflows.id, { onDelete: "cascade" }),
  browserSessionId: text("browser_session_id").references(() => browserSessions.sessionId, { onDelete: "set null" }),

  status: websiteWorkflowRunStatusEnum("status").notNull().default("pending"),

  // Execution Details
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // milliseconds

  // Results
  result: jsonb("result").default({}), // Extracted data, results, etc.
  error: text("error"), // Error message if failed
  logs: jsonb("logs").default([]), // Execution logs

  // Screenshots & Evidence
  screenshotPaths: jsonb("screenshot_paths").default([]),

  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  workflowIdx: index("website_workflow_run_workflow_idx").on(table.workflowId),
  statusIdx: index("website_workflow_run_status_idx").on(table.status),
  startedAtIdx: index("website_workflow_run_started_idx").on(table.startedAt),
  sessionIdx: index("website_workflow_run_session_idx").on(table.browserSessionId),
}));

// ============================================================================
// TYPES - Export types for use in app and frontend
// ============================================================================

export type Website = typeof websites.$inferSelect;
export type WebsiteInsert = typeof websites.$inferInsert;
export type WebsiteId = typeof websites.$inferSelect["id"];

export type WebsitePage = typeof websitePages.$inferSelect;
export type WebsitePageInsert = typeof websitePages.$inferInsert;
export type WebsitePageId = typeof websitePages.$inferSelect["id"];

export type WebsiteElement = typeof websiteElements.$inferSelect;
export type WebsiteElementInsert = typeof websiteElements.$inferInsert;
export type WebsiteElementId = typeof websiteElements.$inferSelect["id"];

export type WebsiteWorkflow = typeof websiteWorkflows.$inferSelect;
export type WebsiteWorkflowInsert = typeof websiteWorkflows.$inferInsert;
export type WebsiteWorkflowId = typeof websiteWorkflows.$inferSelect["id"];
export type WebsiteWorkflowType = typeof websiteWorkflowTypeEnum.enumValues[number];
export type WebsiteWorkflowStatus = typeof websiteWorkflowStatusEnum.enumValues[number];

export type WebsiteWorkflowRun = typeof websiteWorkflowRuns.$inferSelect;
export type WebsiteWorkflowRunInsert = typeof websiteWorkflowRuns.$inferInsert;
export type WebsiteWorkflowRunId = typeof websiteWorkflowRuns.$inferSelect["id"];
export type WebsiteWorkflowRunStatus = typeof websiteWorkflowRunStatusEnum.enumValues[number];


// PRODUCT & PRICE TRACKING ############################################################################################################

/**
 * Merged Products Table - Master Product Database
 * This is the "golden record" for each unique product across all sources.
 * Contains aggregated/best data from all source products.
 */
export const mergedProducts = pgTable("merged_products", {
  id: serial("id").primaryKey(),

  // Product Identifiers
  ean: text("ean").unique(), // EAN-13, GTIN, UPC, etc. (taken from most reliable source)
  asin: text("asin"), // Amazon Standard Identification Number (if available)

  // Product Information (aggregated from all sources)
  name: text("name").notNull(), // Best/most complete name
  brand: text("brand"),
  model: text("model"),
  category: text("category"),
  description: text("description"), // Best/longest description
  imageUrl: text("image_url"), // Primary image URL

  // Images from all sources
  images: jsonb("images").default([]), // Array of image URLs from all sources

  // Metadata
  metadata: jsonb("metadata").default({}), // Aggregated metadata

  // Quality Score (how confident are we in this data?)
  dataQualityScore: numeric("data_quality_score", { precision: 3, scale: 2 }).notNull().default("1.00"), // 0.00 - 1.00

  // Statistics
  sourceCount: integer("source_count").notNull().default(0), // How many source products merged into this

  // Timestamps
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  eanIdx: index("merged_product_ean_idx").on(table.ean),
  asinIdx: index("merged_product_asin_idx").on(table.asin),
  brandModelIdx: index("merged_product_brand_model_idx").on(table.brand, table.model),
  nameIdx: index("merged_product_name_idx").on(table.name),
}));

/**
 * Products Table - Source-Specific Products
 * Each product represents how a product appears on a specific website/platform.
 * Multiple products can be merged into one mergedProduct.
 */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),

  // Reference to merged product (NULL if not yet merged)
  mergedProductId: integer("merged_product_id").references(() => mergedProducts.id, { onDelete: "set null" }),

  // Product Identifiers (as found on this source)
  ean: text("ean"), // EAN-13, GTIN, UPC, etc. (not unique - can differ per source!)
  asin: text("asin"), // Amazon Standard Identification Number

  // Product Information (as found on this source)
  name: text("name").notNull(),
  brand: text("brand"),
  model: text("model"),
  category: text("category"),
  description: text("description"),
  imageUrl: text("image_url"),

  // Metadata (source-specific)
  metadata: jsonb("metadata").default({}), // Additional product attributes from this source

  // Timestamps
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  mergedProductIdx: index("product_merged_product_idx").on(table.mergedProductId),
  eanIdx: index("product_ean_idx").on(table.ean),
  asinIdx: index("product_asin_idx").on(table.asin),
  brandModelIdx: index("product_brand_model_idx").on(table.brand, table.model),
  nameIdx: index("product_name_idx").on(table.name),
}));

/**
 * Product Variants Table - Variant-level grouping beneath merged products
 * Each variant represents a specific configuration (e.g., size, storage)
 */
export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  mergedProductId: integer("merged_product_id").references(() => mergedProducts.id, { onDelete: "cascade" }),
  primaryProductId: integer("primary_product_id").references(() => products.id, { onDelete: "set null" }),

  // Variant identity
  fingerprint: text("fingerprint").notNull(), // Deterministic hash of variant-defining attributes
  label: text("label"), // Human-friendly label (e.g., "50 Zoll / 128GB")
  attributes: jsonb("attributes").notNull().default({}), // Snapshot of variant-defining attributes

  // Flags
  isDefault: boolean("is_default").notNull().default(false), // True if this is the catch-all variant

  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  mergedFingerprintUnique: unique("product_variant_merged_fingerprint_unique").on(table.mergedProductId, table.fingerprint),
  primaryProductUnique: unique("product_variant_primary_product_unique").on(table.primaryProductId),
  mergedIdx: index("product_variant_merged_idx").on(table.mergedProductId),
  fingerprintIdx: index("product_variant_fingerprint_idx").on(table.fingerprint),
}));

/**
 * Product Sources Table - Where Products Are Found
 * Links products to specific shop URLs/pages
 */
export const productSources = pgTable("product_sources", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  websitePageId: integer("website_page_id").notNull().references(() => websitePages.id, { onDelete: "cascade" }),

  // Source-specific identifiers
  shopProductId: text("shop_product_id"), // Shop's internal product ID
  shopSku: text("shop_sku"), // Shop's SKU

  // Extraction Configuration
  priceSelector: text("price_selector"), // CSS selector for price
  availabilitySelector: text("availability_selector"), // CSS selector for stock status
  titleSelector: text("title_selector"),
  imageSelector: text("image_selector"),

  // Current State
  isActive: boolean("is_active").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at"),
  lastSeenAt: timestamp("last_seen_at"), // Last time product was available

  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  productIdx: index("product_source_product_idx").on(table.productId),
  websitePageIdx: index("product_source_page_idx").on(table.websitePageId),
  productPageUnique: unique("product_source_product_page_unique").on(table.productId, table.websitePageId),
  isActiveIdx: index("product_source_active_idx").on(table.isActive),
  lastScrapedIdx: index("product_source_last_scraped_idx").on(table.lastScrapedAt),
}));

/**
 * Product Prices Table - Current Prices
 * Stores the most recent price for each product source AND variant combination
 * This allows tracking prices for different variants (e.g., 55" vs 65") from different shops
 */
export const productPrices = pgTable("product_prices", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  productSourceId: integer("product_source_id").notNull().references(() => productSources.id, { onDelete: "cascade" }),

  // Price Information
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  originalPrice: numeric("original_price", { precision: 10, scale: 2 }), // Crossed-out price
  discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }),

  // Availability
  availability: productAvailabilityEnum("availability").notNull().default("unknown"),
  stockQuantity: integer("stock_quantity"), // If available

  // Shipping & Extras
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }),

  // Price Confidence
  isPriceError: boolean("is_price_error").notNull().default(false), // Flagged as suspicious
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull().default("1.00"), // 0-1 confidence score

  metadata: jsonb("metadata").default({}),
  scrapedAt: timestamp("scraped_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  variantIdx: index("product_price_variant_idx").on(table.variantId),
  productSourceIdx: index("product_price_source_idx").on(table.productSourceId),
  variantSourceUnique: unique("product_price_variant_source_unique").on(table.variantId, table.productSourceId), // One price per variant+source combination
  priceIdx: index("product_price_price_idx").on(table.price),
  availabilityIdx: index("product_price_availability_idx").on(table.availability),
  isPriceErrorIdx: index("product_price_error_idx").on(table.isPriceError),
  scrapedAtIdx: index("product_price_scraped_idx").on(table.scrapedAt),
}));

/**
 * Price History Table - Historical Price Tracking
 * Stores price changes over time for trend analysis
 * Tracks prices for specific variant+source combinations
 */
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  productSourceId: integer("product_source_id").notNull().references(() => productSources.id, { onDelete: "cascade" }),

  // Price Information (snapshot at time)
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
  discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }),

  // Availability (snapshot at time)
  availability: productAvailabilityEnum("availability").notNull().default("unknown"),
  stockQuantity: integer("stock_quantity"),

  // Change Detection
  priceChanged: boolean("price_changed").notNull().default(false), // Did price change from previous?
  priceDelta: numeric("price_delta", { precision: 10, scale: 2 }), // Price difference from previous
  percentageChange: numeric("percentage_change", { precision: 5, scale: 2 }), // % change from previous

  metadata: jsonb("metadata").default({}),
  recordedAt: timestamp("recorded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  variantIdx: index("price_history_variant_idx").on(table.variantId),
  productSourceIdx: index("price_history_source_idx").on(table.productSourceId),
  recordedAtIdx: index("price_history_recorded_idx").on(table.recordedAt),
  priceChangedIdx: index("price_history_changed_idx").on(table.priceChanged),
  variantSourceRecordedIdx: index("price_history_variant_source_recorded_idx").on(table.variantId, table.productSourceId, table.recordedAt),
}));

/**
 * Price Alerts Table - Price Drop/Error Alerts
 * Tracks user-defined alerts for price monitoring
 * Alerts can be set on merged products (all variants) OR specific variants
 */
export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  mergedProductId: integer("merged_product_id").references(() => mergedProducts.id, { onDelete: "cascade" }), // Alert for all variants
  variantId: integer("variant_id").references(() => productVariants.id, { onDelete: "cascade" }), // Alert for specific variant
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }), // Optional: user-specific alerts

  // Alert Configuration
  type: priceAlertTypeEnum("type").notNull(),
  status: priceAlertStatusEnum("status").notNull().default("active"),

  // Thresholds
  targetPrice: numeric("target_price", { precision: 10, scale: 2 }), // For "below_price" type
  percentageThreshold: numeric("percentage_threshold", { precision: 5, scale: 2 }), // For "percentage_drop" type

  // Alert Details
  name: text("name").notNull(), // e.g., "Alert me when iPhone 15 < €800"
  description: text("description"),

  // Notification Preferences
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyWebhook: boolean("notify_webhook").notNull().default(false),
  webhookUrl: text("webhook_url"),

  // Alert State
  triggeredAt: timestamp("triggered_at"), // When alert was triggered
  triggeredPrice: numeric("triggered_price", { precision: 10, scale: 2 }), // Price when triggered
  acknowledgedAt: timestamp("acknowledged_at"), // When user saw the alert

  // Auto-management
  expiresAt: timestamp("expires_at"), // Optional expiry date

  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  mergedProductIdx: index("price_alert_merged_product_idx").on(table.mergedProductId),
  variantIdx: index("price_alert_variant_idx").on(table.variantId),
  userIdx: index("price_alert_user_idx").on(table.userId),
  statusIdx: index("price_alert_status_idx").on(table.status),
  typeIdx: index("price_alert_type_idx").on(table.type),
  triggeredAtIdx: index("price_alert_triggered_idx").on(table.triggeredAt),
  expiresAtIdx: index("price_alert_expires_idx").on(table.expiresAt),
}));

/**
 * Product Attributes Table - Structured Product Attributes
 * Extracts and stores structured information like screen size, storage, color, etc.
 * Attributes are stored on merged products (only once per product, not per source!)
 */
export const productAttributes = pgTable("product_attributes", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),

  // Attribute Details
  type: productAttributeTypeEnum("type").notNull(),
  key: text("key").notNull(), // e.g., "screen_size", "storage_capacity"
  value: text("value").notNull(), // e.g., "55", "256"
  unit: text("unit"), // e.g., "Zoll", "GB", "inches"
  displayValue: text("display_value").notNull(), // e.g., "55 Zoll", "256GB"

  // Normalized values for comparison
  normalizedValue: numeric("normalized_value", { precision: 10, scale: 2 }), // Numeric representation: 55.00, 256.00
  normalizedUnit: text("normalized_unit"), // Standardized unit: "inch", "gb"

  // Source & Confidence
  source: text("source").notNull().default("extracted"), // "extracted", "manual", "api"
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull().default("1.00"),

  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  variantIdx: index("product_attribute_variant_idx").on(table.variantId),
  typeIdx: index("product_attribute_type_idx").on(table.type),
  keyIdx: index("product_attribute_key_idx").on(table.key),
  normalizedValueIdx: index("product_attribute_normalized_idx").on(table.normalizedValue),
  variantTypeKeyUnique: unique("product_attribute_variant_type_key_unique").on(table.variantId, table.type, table.key),
}));


/**
 * Product Match Suggestions Table - Review Queue for Uncertain Matches
 * Stores potential product matches that need manual review
 */
export const productMatchSuggestions = pgTable("product_match_suggestions", {
  id: serial("id").primaryKey(),

  // Products to compare
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  mergedProductId: integer("merged_product_id").notNull().references(() => mergedProducts.id, { onDelete: "cascade" }),

  // Suggestion Details
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(), // 0.00 - 1.00
  matchReasons: jsonb("match_reasons").notNull().default([]),

  // Comparison Data (for UI display)
  comparisonData: jsonb("comparison_data").default({}), // Detailed comparison for review UI

  // Status
  status: productMatchStatusEnum("status").notNull().default("pending"),

  // Review
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),

  // Action taken
  actionTaken: text("action_taken"), // "merged", "kept_separate", "dismissed"

  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  productIdx: index("product_match_suggestion_product_idx").on(table.productId),
  mergedIdx: index("product_match_suggestion_merged_idx").on(table.mergedProductId),
  statusIdx: index("product_match_suggestion_status_idx").on(table.status),
  confidenceIdx: index("product_match_suggestion_confidence_idx").on(table.confidence),
  createdAtIdx: index("product_match_suggestion_created_idx").on(table.createdAt),
  productMergedUnique: unique("product_match_suggestion_product_merged_unique").on(table.productId, table.mergedProductId),
}));

// ============================================================================
// TYPES - Export types for use in app and frontend
// ============================================================================

export type MergedProduct = typeof mergedProducts.$inferSelect;
export type MergedProductInsert = typeof mergedProducts.$inferInsert;
export type MergedProductId = typeof mergedProducts.$inferSelect["id"];

export type Product = typeof products.$inferSelect;
export type ProductInsert = typeof products.$inferInsert;
export type ProductId = typeof products.$inferSelect["id"];

export type ProductVariant = typeof productVariants.$inferSelect;
export type ProductVariantInsert = typeof productVariants.$inferInsert;
export type ProductVariantId = typeof productVariants.$inferSelect["id"];

export type ProductSource = typeof productSources.$inferSelect;
export type ProductSourceInsert = typeof productSources.$inferInsert;
export type ProductSourceId = typeof productSources.$inferSelect["id"];

export type ProductPrice = typeof productPrices.$inferSelect;
export type ProductPriceInsert = typeof productPrices.$inferInsert;
export type ProductPriceId = typeof productPrices.$inferSelect["id"];
export type ProductAvailability = typeof productAvailabilityEnum.enumValues[number];

export type PriceHistory = typeof priceHistory.$inferSelect;
export type PriceHistoryInsert = typeof priceHistory.$inferInsert;
export type PriceHistoryId = typeof priceHistory.$inferSelect["id"];

export type PriceAlert = typeof priceAlerts.$inferSelect;
export type PriceAlertInsert = typeof priceAlerts.$inferInsert;
export type PriceAlertId = typeof priceAlerts.$inferSelect["id"];
export type PriceAlertType = typeof priceAlertTypeEnum.enumValues[number];
export type PriceAlertStatus = typeof priceAlertStatusEnum.enumValues[number];

export type ProductAttribute = typeof productAttributes.$inferSelect;
export type ProductAttributeInsert = typeof productAttributes.$inferInsert;
export type ProductAttributeId = typeof productAttributes.$inferSelect["id"];
export type ProductAttributeType = typeof productAttributeTypeEnum.enumValues[number];

export type ProductMatchStatus = typeof productMatchStatusEnum.enumValues[number];

export type ProductMatchSuggestion = typeof productMatchSuggestions.$inferSelect;
export type ProductMatchSuggestionInsert = typeof productMatchSuggestions.$inferInsert;
