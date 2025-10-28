CREATE TYPE "public"."app_log_level" AS ENUM('info', 'warn', 'error', 'debug', 'fatal', 'critical');--> statement-breakpoint
CREATE TYPE "public"."app_settings_type" AS ENUM('string', 'number', 'boolean', 'json');--> statement-breakpoint
CREATE TYPE "public"."role_assignment_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('pending', 'processed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."browser_activity_type" AS ENUM('navigation', 'screenshot', 'interaction', 'script', 'extraction');--> statement-breakpoint
CREATE TYPE "public"."browser_session_status" AS ENUM('idle', 'active', 'navigating', 'closed');--> statement-breakpoint
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
CREATE TABLE "website_elements" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
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
CREATE TABLE "websites" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"path" text NOT NULL,
	"title" text,
	"content_hash" text,
	"last_scanned_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "websites_url_unique" UNIQUE("url")
);
--> statement-breakpoint
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
ALTER TABLE "website_elements" ADD CONSTRAINT "website_elements_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_log_level_idx" ON "app_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "app_log_created_at_idx" ON "app_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_settings_key_idx" ON "app_settings" USING btree ("key");--> statement-breakpoint
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
CREATE INDEX "website_element_website_idx" ON "website_elements" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "website_element_selector_idx" ON "website_elements" USING btree ("css_selector");--> statement-breakpoint
CREATE INDEX "website_element_tag_idx" ON "website_elements" USING btree ("tag_name");--> statement-breakpoint
CREATE INDEX "website_url_idx" ON "websites" USING btree ("url");--> statement-breakpoint
CREATE INDEX "website_domain_idx" ON "websites" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "website_domain_path_idx" ON "websites" USING btree ("domain","path");