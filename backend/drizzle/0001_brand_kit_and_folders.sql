CREATE TABLE "brand_kit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kit_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_kit_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kit_color" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_kit_id" uuid NOT NULL,
	"name" text,
	"hex" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_folder_id" uuid,
	"brand_kit_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "last_edited_by_user_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "brand_kit" ADD CONSTRAINT "brand_kit_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kit_asset" ADD CONSTRAINT "brand_kit_asset_brand_kit_id_brand_kit_id_fk" FOREIGN KEY ("brand_kit_id") REFERENCES "public"."brand_kit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kit_color" ADD CONSTRAINT "brand_kit_color_brand_kit_id_brand_kit_id_fk" FOREIGN KEY ("brand_kit_id") REFERENCES "public"."brand_kit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_parent_folder_id_folder_id_fk" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_brand_kit_id_brand_kit_id_fk" FOREIGN KEY ("brand_kit_id") REFERENCES "public"."brand_kit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_kit_asset_kit_idx" ON "brand_kit_asset" USING btree ("brand_kit_id");--> statement-breakpoint
CREATE INDEX "brand_kit_asset_kind_idx" ON "brand_kit_asset" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "brand_kit_color_kit_idx" ON "brand_kit_color" USING btree ("brand_kit_id");--> statement-breakpoint
CREATE INDEX "folder_parent_idx" ON "folder" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE INDEX "folder_brand_kit_idx" ON "folder" USING btree ("brand_kit_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_last_edited_by_user_id_user_id_fk" FOREIGN KEY ("last_edited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_folder_id_idx" ON "document" USING btree ("folder_id");