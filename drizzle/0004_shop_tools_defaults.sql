-- The old "Announcement bar" setting becomes a top-bar banner (Admin → Banners).
INSERT INTO "banners" ("placement", "title")
SELECT 'bar', "value" FROM "settings" WHERE "key" = 'announcement' AND "value" <> '';
--> statement-breakpoint
DELETE FROM "settings" WHERE "key" = 'announcement';
--> statement-breakpoint
-- Shop details from the Google Business profile, pickup at the shop, and the
-- letter-size chart. Only fills values that are missing or empty; edit them in admin.
INSERT INTO "settings" ("key", "value") VALUES
  ('address', 'Favour Plaza, Lokongoma Phase 1, Lokoja, Kogi State'),
  ('email', 'officialdeniks20@gmail.com'),
  ('pickupEnabled', '1'),
  ('pickupNote', 'Bring your order number. We’ll message you when your order is ready to collect.'),
  ('sizeChart', '[{"size":"S","bust":35,"waist":28,"hips":38},{"size":"M","bust":37,"waist":30,"hips":40},{"size":"L","bust":40,"waist":33,"hips":43},{"size":"XL","bust":43,"waist":36,"hips":46},{"size":"XXL","bust":46,"waist":39,"hips":49},{"size":"3XL","bust":49,"waist":42,"hips":52}]')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now()
WHERE "settings"."value" = '';
