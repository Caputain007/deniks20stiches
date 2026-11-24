CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"placement" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link_label" text DEFAULT '' NOT NULL,
	"link_url" text DEFAULT '' NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"image_width" integer,
	"image_height" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"min_subtotal_kobo" bigint DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"once_per_customer" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "measurement_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"purpose" text NOT NULL,
	"unit" text NOT NULL,
	"values" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"order_number" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"ip_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measurement_requests_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment" text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_kobo" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "condition" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
CREATE INDEX "measurement_requests_status_idx" ON "measurement_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "measurement_requests_ip_idx" ON "measurement_requests" USING btree ("ip_hash","created_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_coupon_idx" ON "orders" USING btree ("coupon_id");