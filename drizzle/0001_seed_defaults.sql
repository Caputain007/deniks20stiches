-- Starting categories (the same ones the old catalogue page had). Edit them in Admin → Categories.
INSERT INTO "categories" ("name", "slug", "position") VALUES
  ('Ready-to-Wear', 'ready-to-wear', 1),
  ('Malaysian Hijabs', 'hijabs', 2),
  ('Abayas', 'abayas', 3),
  ('Accessories', 'accessories', 4)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
-- Contact details carried over from the old site. Edit them in Admin → Settings.
INSERT INTO "settings" ("key", "value") VALUES
  ('whatsapp', '2349017181181'),
  ('phone', '+234 901 718 1181')
ON CONFLICT ("key") DO NOTHING;
