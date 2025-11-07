CREATE TYPE "public"."app_log_level" AS ENUM('info', 'warn', 'error', 'debug', 'fatal', 'critical');--> statement-breakpoint
CREATE TYPE "public"."app_settings_type" AS ENUM('string', 'number', 'boolean', 'json');--> statement-breakpoint
CREATE TYPE "public"."role_assignment_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('pending', 'processed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."browser_activity_type" AS ENUM('navigation', 'screenshot', 'interaction', 'script', 'extraction');--> statement-breakpoint
CREATE TYPE "public"."browser_session_status" AS ENUM('idle', 'active', 'navigating', 'closed');--> statement-breakpoint
CREATE TYPE "public"."price_alert_status" AS ENUM('active', 'triggered', 'expired', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."price_alert_type" AS ENUM('below_price', 'percentage_drop', 'back_in_stock', 'price_error');--> statement-breakpoint
CREATE TYPE "public"."product_attribute_type" AS ENUM('screen_size', 'storage', 'memory', 'color', 'resolution', 'processor', 'weight', 'dimensions', 'connectivity', 'custom');--> statement-breakpoint
CREATE TYPE "public"."product_availability" AS ENUM('in_stock', 'out_of_stock', 'limited_stock', 'preorder', 'discontinued', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."product_match_status" AS ENUM('pending', 'accepted', 'rejected', 'auto_merged');--> statement-breakpoint
CREATE TYPE "public"."scraping_quality_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."scraping_quality_status" AS ENUM('open', 'acknowledged', 'resolved', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."website_workflow_run_status" AS ENUM('pending', 'running', 'success', 'failed', 'timeout', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."website_workflow_status" AS ENUM('active', 'paused', 'disabled', 'error');--> statement-breakpoint
CREATE TYPE "public"."website_workflow_type" AS ENUM('price_check', 'data_extraction', 'form_fill', 'monitoring', 'scraping', 'testing', 'custom');--> statement-breakpoint
CREATE TABLE "app_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" "app_log_level" NOT NULL,
	"message" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" varchar NOT NULL,
	"type" "app_settings_type" NOT NULL,
	"description" text,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "browser_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"fingerprint_seed" integer NOT NULL,
	"user_data_path" text NOT NULL,
	"user_id" integer,
	"description" text,
	"created_at" timestamp NOT NULL,
	"last_used_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "browser_profiles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "unique_permission_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" "role_assignment_status" NOT NULL,
	"role_id" integer NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_to" timestamp,
	"assigned_by" integer NOT NULL,
	"revoked_by" integer,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"assigned_by" integer NOT NULL,
	"revoked_by" integer,
	"created_at" timestamp NOT NULL,
	"valid_to" timestamp
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"activity_date" date NOT NULL,
	"first_activity_at" timestamp NOT NULL,
	"last_activity_at" timestamp NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"requests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_activity_unique_user_date" UNIQUE("user_id","activity_date")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_user_id" text,
	"email" text,
	"first_name" text,
	"last_name" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"status" "webhook_status" DEFAULT 'pending' NOT NULL,
	"process_message" text,
	"origin_url" text,
	"created_at" timestamp NOT NULL,
	"processed_at" timestamp,
	"user_agent" text,
	"signature" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "browser_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"type" "browser_activity_type" NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"value" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"success" boolean DEFAULT true NOT NULL,
	"error" text,
	"duration" integer,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "browser_extracted_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"activity_id" integer,
	"url" text NOT NULL,
	"data_type" text NOT NULL,
	"data" jsonb NOT NULL,
	"schema" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "browser_screenshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"activity_id" integer,
	"url" text NOT NULL,
	"title" text,
	"path" text NOT NULL,
	"full_page" boolean DEFAULT false NOT NULL,
	"width" integer,
	"height" integer,
	"size" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "browser_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" integer,
	"status" "browser_session_status" DEFAULT 'idle' NOT NULL,
	"current_url" text,
	"title" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp NOT NULL,
	"last_activity_at" timestamp NOT NULL,
	"closed_at" timestamp,
	CONSTRAINT "browser_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "merged_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"ean" text,
	"asin" text,
	"name" text NOT NULL,
	"brand" text,
	"model" text,
	"category" text,
	"description" text,
	"image_url" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"data_quality_score" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "merged_products_ean_unique" UNIQUE("ean")
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"merged_product_id" integer,
	"variant_id" integer,
	"user_id" integer,
	"type" "price_alert_type" NOT NULL,
	"status" "price_alert_status" DEFAULT 'active' NOT NULL,
	"target_price" numeric(10, 2),
	"percentage_threshold" numeric(5, 2),
	"name" text NOT NULL,
	"description" text,
	"notify_email" boolean DEFAULT true NOT NULL,
	"notify_webhook" boolean DEFAULT false NOT NULL,
	"webhook_url" text,
	"triggered_at" timestamp,
	"triggered_price" numeric(10, 2),
	"acknowledged_at" timestamp,
	"expires_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL,
	"product_source_id" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"original_price" numeric(10, 2),
	"discount_percentage" numeric(5, 2),
	"availability" "product_availability" DEFAULT 'unknown' NOT NULL,
	"stock_quantity" integer,
	"price_changed" boolean DEFAULT false NOT NULL,
	"price_delta" numeric(10, 2),
	"percentage_change" numeric(5, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"recorded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"variant_id" integer,
	"type" "product_attribute_type" NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"unit" text,
	"display_value" text NOT NULL,
	"normalized_value" numeric(10, 2),
	"normalized_unit" text,
	"source" text DEFAULT 'extracted' NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "product_attribute_variant_type_key_unique" UNIQUE("variant_id","type","key")
);
--> statement-breakpoint
CREATE TABLE "product_match_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"merged_product_id" integer NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"match_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comparison_data" jsonb DEFAULT '{}'::jsonb,
	"status" "product_match_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"action_taken" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "product_match_suggestion_product_merged_unique" UNIQUE("product_id","merged_product_id")
);
--> statement-breakpoint
CREATE TABLE "product_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"website_page_id" integer NOT NULL,
	"shop_product_id" text,
	"shop_sku" text,
	"price_selector" text,
	"availability_selector" text,
	"title_selector" text,
	"image_selector" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_scraped_at" timestamp,
	"last_seen_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "product_source_product_page_unique" UNIQUE("product_id","website_page_id")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"merged_product_id" integer,
	"primary_product_id" integer,
	"fingerprint" text NOT NULL,
	"label" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "product_variant_merged_fingerprint_unique" UNIQUE("merged_product_id","fingerprint"),
	CONSTRAINT "product_variant_primary_product_unique" UNIQUE("primary_product_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"merged_product_id" integer,
	"ean" text,
	"asin" text,
	"name" text NOT NULL,
	"brand" text,
	"model" text,
	"category" text,
	"description" text,
	"image_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraping_quality_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"adapter" text,
	"product_id" integer,
	"issue_fingerprint" text NOT NULL,
	"missing_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"field_errors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"extracted_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"severity" "scraping_quality_severity" NOT NULL,
	"status" "scraping_quality_status" DEFAULT 'open' NOT NULL,
	"first_seen_at" timestamp NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"resolution" text,
	"resolution_notes" text,
	"screenshot" text,
	"page_html_sample" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "scraping_quality_dedup_unique" UNIQUE("domain","adapter","issue_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "website_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"username" text,
	"password" text,
	"totp_secret" text,
	"session_data" jsonb DEFAULT '{}'::jsonb,
	"session_expires_at" timestamp,
	"label" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"last_validated_at" timestamp,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"last_failed_at" timestamp,
	"last_error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_elements" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"tag_name" varchar(100) NOT NULL,
	"css_selector" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"classes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"text_content" text,
	"name" text,
	"href" text,
	"type" text,
	"role" text,
	"form_action" text,
	"visible" boolean DEFAULT false NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"bounding_box" jsonb,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"url" text NOT NULL,
	"path" text NOT NULL,
	"title" text,
	"description" text,
	"content_hash" text,
	"html_snapshot" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"last_scanned_at" timestamp,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "website_pages_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "website_workflow_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"browser_session_id" text,
	"status" "website_workflow_run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration" integer,
	"result" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"logs" jsonb DEFAULT '[]'::jsonb,
	"screenshot_paths" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"page_id" integer,
	"name" text NOT NULL,
	"description" text,
	"type" "website_workflow_type" NOT NULL,
	"status" "website_workflow_status" DEFAULT 'active' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"selectors" jsonb DEFAULT '{}'::jsonb,
	"schedule" text,
	"retry_count" integer DEFAULT 3 NOT NULL,
	"timeout" integer DEFAULT 30000 NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"name" text,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "websites_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD CONSTRAINT "browser_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_activities" ADD CONSTRAINT "browser_activities_session_id_browser_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."browser_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_extracted_data" ADD CONSTRAINT "browser_extracted_data_session_id_browser_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."browser_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_extracted_data" ADD CONSTRAINT "browser_extracted_data_activity_id_browser_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."browser_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_screenshots" ADD CONSTRAINT "browser_screenshots_session_id_browser_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."browser_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_screenshots" ADD CONSTRAINT "browser_screenshots_activity_id_browser_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."browser_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_merged_product_id_merged_products_id_fk" FOREIGN KEY ("merged_product_id") REFERENCES "public"."merged_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_source_id_product_sources_id_fk" FOREIGN KEY ("product_source_id") REFERENCES "public"."product_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_match_suggestions" ADD CONSTRAINT "product_match_suggestions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_match_suggestions" ADD CONSTRAINT "product_match_suggestions_merged_product_id_merged_products_id_fk" FOREIGN KEY ("merged_product_id") REFERENCES "public"."merged_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_match_suggestions" ADD CONSTRAINT "product_match_suggestions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sources" ADD CONSTRAINT "product_sources_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sources" ADD CONSTRAINT "product_sources_website_page_id_website_pages_id_fk" FOREIGN KEY ("website_page_id") REFERENCES "public"."website_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_merged_product_id_merged_products_id_fk" FOREIGN KEY ("merged_product_id") REFERENCES "public"."merged_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_primary_product_id_products_id_fk" FOREIGN KEY ("primary_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merged_product_id_merged_products_id_fk" FOREIGN KEY ("merged_product_id") REFERENCES "public"."merged_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraping_quality_logs" ADD CONSTRAINT "scraping_quality_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraping_quality_logs" ADD CONSTRAINT "scraping_quality_logs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_credentials" ADD CONSTRAINT "website_credentials_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_elements" ADD CONSTRAINT "website_elements_page_id_website_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."website_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_workflow_runs" ADD CONSTRAINT "website_workflow_runs_workflow_id_website_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."website_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_workflow_runs" ADD CONSTRAINT "website_workflow_runs_browser_session_id_browser_sessions_session_id_fk" FOREIGN KEY ("browser_session_id") REFERENCES "public"."browser_sessions"("session_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_workflows" ADD CONSTRAINT "website_workflows_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_workflows" ADD CONSTRAINT "website_workflows_page_id_website_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."website_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_log_level_idx" ON "app_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "app_log_created_at_idx" ON "app_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_settings_key_idx" ON "app_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "browser_profile_name_idx" ON "browser_profiles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "browser_profile_website_idx" ON "browser_profiles" USING btree ("website");--> statement-breakpoint
CREATE INDEX "browser_profile_user_idx" ON "browser_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "browser_profile_last_used_idx" ON "browser_profiles" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "role_assignment_user_idx" ON "role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "role_assignment_role_idx" ON "role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permission_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permission_permission_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "user_activity_user_idx" ON "user_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_activity_date_idx" ON "user_activities" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "user_activity_user_date_idx" ON "user_activities" USING btree ("user_id","activity_date");--> statement-breakpoint
CREATE INDEX "webhook_external_id_idx" ON "webhooks" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "webhook_provider_event_idx" ON "webhooks" USING btree ("provider","event_type");--> statement-breakpoint
CREATE INDEX "browser_activity_session_idx" ON "browser_activities" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "browser_activity_type_idx" ON "browser_activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "browser_activity_timestamp_idx" ON "browser_activities" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "browser_extracted_data_session_idx" ON "browser_extracted_data" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "browser_extracted_data_type_idx" ON "browser_extracted_data" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "browser_extracted_data_url_idx" ON "browser_extracted_data" USING btree ("url");--> statement-breakpoint
CREATE INDEX "browser_extracted_data_created_idx" ON "browser_extracted_data" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "browser_screenshot_session_idx" ON "browser_screenshots" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "browser_screenshot_path_idx" ON "browser_screenshots" USING btree ("path");--> statement-breakpoint
CREATE INDEX "browser_session_id_idx" ON "browser_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "browser_session_status_idx" ON "browser_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "browser_session_user_idx" ON "browser_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "merged_product_ean_idx" ON "merged_products" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "merged_product_asin_idx" ON "merged_products" USING btree ("asin");--> statement-breakpoint
CREATE INDEX "merged_product_brand_model_idx" ON "merged_products" USING btree ("brand","model");--> statement-breakpoint
CREATE INDEX "merged_product_name_idx" ON "merged_products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "price_alert_merged_product_idx" ON "price_alerts" USING btree ("merged_product_id");--> statement-breakpoint
CREATE INDEX "price_alert_variant_idx" ON "price_alerts" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "price_alert_user_idx" ON "price_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "price_alert_status_idx" ON "price_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "price_alert_type_idx" ON "price_alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "price_alert_triggered_idx" ON "price_alerts" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "price_alert_expires_idx" ON "price_alerts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "price_history_variant_idx" ON "price_history" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "price_history_source_idx" ON "price_history" USING btree ("product_source_id");--> statement-breakpoint
CREATE INDEX "price_history_recorded_idx" ON "price_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "price_history_changed_idx" ON "price_history" USING btree ("price_changed");--> statement-breakpoint
CREATE INDEX "price_history_variant_source_recorded_idx" ON "price_history" USING btree ("variant_id","product_source_id","recorded_at");--> statement-breakpoint
CREATE INDEX "product_attribute_variant_idx" ON "product_attributes" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_attribute_type_idx" ON "product_attributes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "product_attribute_key_idx" ON "product_attributes" USING btree ("key");--> statement-breakpoint
CREATE INDEX "product_attribute_normalized_idx" ON "product_attributes" USING btree ("normalized_value");--> statement-breakpoint
CREATE INDEX "product_match_suggestion_product_idx" ON "product_match_suggestions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_match_suggestion_merged_idx" ON "product_match_suggestions" USING btree ("merged_product_id");--> statement-breakpoint
CREATE INDEX "product_match_suggestion_status_idx" ON "product_match_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_match_suggestion_confidence_idx" ON "product_match_suggestions" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "product_match_suggestion_created_idx" ON "product_match_suggestions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "product_source_product_idx" ON "product_sources" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_source_page_idx" ON "product_sources" USING btree ("website_page_id");--> statement-breakpoint
CREATE INDEX "product_source_active_idx" ON "product_sources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "product_source_last_scraped_idx" ON "product_sources" USING btree ("last_scraped_at");--> statement-breakpoint
CREATE INDEX "product_variant_merged_idx" ON "product_variants" USING btree ("merged_product_id");--> statement-breakpoint
CREATE INDEX "product_variant_fingerprint_idx" ON "product_variants" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "product_merged_product_idx" ON "products" USING btree ("merged_product_id");--> statement-breakpoint
CREATE INDEX "product_ean_idx" ON "products" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "product_asin_idx" ON "products" USING btree ("asin");--> statement-breakpoint
CREATE INDEX "product_brand_model_idx" ON "products" USING btree ("brand","model");--> statement-breakpoint
CREATE INDEX "product_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "scraping_quality_url_idx" ON "scraping_quality_logs" USING btree ("url");--> statement-breakpoint
CREATE INDEX "scraping_quality_domain_idx" ON "scraping_quality_logs" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "scraping_quality_adapter_idx" ON "scraping_quality_logs" USING btree ("adapter");--> statement-breakpoint
CREATE INDEX "scraping_quality_severity_idx" ON "scraping_quality_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "scraping_quality_status_idx" ON "scraping_quality_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scraping_quality_product_idx" ON "scraping_quality_logs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "scraping_quality_first_seen_idx" ON "scraping_quality_logs" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "scraping_quality_last_seen_idx" ON "scraping_quality_logs" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "website_credential_website_idx" ON "website_credentials" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "website_credential_active_idx" ON "website_credentials" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "website_credential_username_idx" ON "website_credentials" USING btree ("username");--> statement-breakpoint
CREATE INDEX "website_credential_last_used_idx" ON "website_credentials" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "website_element_page_idx" ON "website_elements" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "website_element_selector_idx" ON "website_elements" USING btree ("css_selector");--> statement-breakpoint
CREATE INDEX "website_element_tag_idx" ON "website_elements" USING btree ("tag_name");--> statement-breakpoint
CREATE INDEX "website_element_visible_idx" ON "website_elements" USING btree ("visible");--> statement-breakpoint
CREATE INDEX "website_page_website_idx" ON "website_pages" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "website_page_url_idx" ON "website_pages" USING btree ("url");--> statement-breakpoint
CREATE INDEX "website_page_path_idx" ON "website_pages" USING btree ("path");--> statement-breakpoint
CREATE INDEX "website_page_domain_path_idx" ON "website_pages" USING btree ("website_id","path");--> statement-breakpoint
CREATE INDEX "website_page_last_scanned_idx" ON "website_pages" USING btree ("last_scanned_at");--> statement-breakpoint
CREATE INDEX "website_workflow_run_workflow_idx" ON "website_workflow_runs" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "website_workflow_run_status_idx" ON "website_workflow_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "website_workflow_run_started_idx" ON "website_workflow_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "website_workflow_run_session_idx" ON "website_workflow_runs" USING btree ("browser_session_id");--> statement-breakpoint
CREATE INDEX "website_workflow_website_idx" ON "website_workflows" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "website_workflow_page_idx" ON "website_workflows" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "website_workflow_type_idx" ON "website_workflows" USING btree ("type");--> statement-breakpoint
CREATE INDEX "website_workflow_status_idx" ON "website_workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "website_workflow_schedule_idx" ON "website_workflows" USING btree ("schedule");--> statement-breakpoint
CREATE INDEX "website_domain_idx" ON "websites" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "website_is_active_idx" ON "websites" USING btree ("is_active");