CREATE TABLE "candidates" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"class" varchar(100) NOT NULL,
	"photo_url" text,
	"manifesto" text,
	"vetting_discipline" integer,
	"vetting_academic" integer,
	"vetting_character" integer,
	"vetting_interview" integer,
	"vetting_total" integer GENERATED ALWAYS AS (vetting_discipline + vetting_academic + vetting_character + vetting_interview) STORED,
	"is_approved" boolean DEFAULT false NOT NULL,
	CONSTRAINT "candidates_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "candidates_vetting_discipline_range" CHECK ("candidates"."vetting_discipline" between 0 and 25),
	CONSTRAINT "candidates_vetting_academic_range" CHECK ("candidates"."vetting_academic" between 0 and 25),
	CONSTRAINT "candidates_vetting_character_range" CHECK ("candidates"."vetting_character" between 0 and 25),
	CONSTRAINT "candidates_vetting_interview_range" CHECK ("candidates"."vetting_interview" between 0 and 25)
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"eligible_classes" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"election_date" date,
	CONSTRAINT "positions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subdomain" varchar(63) NOT NULL,
	"school_name" varchar(255) NOT NULL,
	"primary_color" varchar(7) DEFAULT '#1e40af' NOT NULL,
	"secondary_color" varchar(7) DEFAULT '#f59e0b' NOT NULL,
	"logo_url" text,
	"motto" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain"),
	CONSTRAINT "tenants_subdomain_format" CHECK ("tenants"."subdomain" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
	CONSTRAINT "tenants_primary_color_hex" CHECK ("tenants"."primary_color" ~ '^#[0-9a-fA-F]{6}$'),
	CONSTRAINT "tenants_secondary_color_hex" CHECK ("tenants"."secondary_color" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'teacher' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_email_per_tenant" UNIQUE("tenant_id","email"),
	CONSTRAINT "users_role_valid" CHECK ("users"."role" in ('super_admin', 'admin', 'teacher')),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_position_fk" FOREIGN KEY ("tenant_id","position_id") REFERENCES "public"."positions"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidates_position_idx" ON "candidates" USING btree ("tenant_id","position_id");--> statement-breakpoint
CREATE INDEX "positions_tenant_order_idx" ON "positions" USING btree ("tenant_id","display_order");