-- Run once after `npx prisma db push` created EquipmentCategory and categoryId on Equipment.
-- Maps legacy enum values to new category rows, then drops the old column.

INSERT INTO "EquipmentCategory" ("id", "slug", "name", "description", "iconUrl", "iconKey", "color", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'construction', 'Construction', 'Heavy machinery and site equipment.', '', '', 'bg-orange-50 text-orange-700', 1, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'sports', 'Sports', 'Sports and outdoor gear.', '', '', 'bg-green-50 text-green-700', 2, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'events', 'Events', 'Events and party rentals.', '', '', 'bg-purple-50 text-purple-700', 3, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tools', 'Tools', 'Tools and workshop equipment.', '', '', 'bg-blue-50 text-blue-700', 4, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'other', 'Other', 'Other equipment.', '', '', 'bg-stone-50 text-stone-600', 99, true, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- If categoryId column exists but is empty and legacy "category" enum column still exists:
-- UPDATE "Equipment" e
-- SET "categoryId" = c."id"
-- FROM "EquipmentCategory" c
-- WHERE lower(e."category"::text) = c."slug" AND e."categoryId" IS NULL;
