/**
 * One-time migration: legacy Equipment.category enum → categoryId FK.
 * Run after `categoryId` is optional on Equipment: npm run db:migrate-categories
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { slug: "construction", name: "Construction", description: "Heavy machinery and site equipment.", color: "bg-orange-50 text-orange-700", sortOrder: 1 },
  { slug: "sports", name: "Sports", description: "Sports and outdoor gear.", color: "bg-green-50 text-green-700", sortOrder: 2 },
  { slug: "events", name: "Events", description: "Events and party rentals.", color: "bg-purple-50 text-purple-700", sortOrder: 3 },
  { slug: "tools", name: "Tools", description: "Tools and workshop equipment.", color: "bg-blue-50 text-blue-700", sortOrder: 4 },
  { slug: "other", name: "Other", description: "Other equipment.", color: "bg-stone-50 text-stone-600", sortOrder: 99 },
] as const;

const ENUM_TO_SLUG: Record<string, string> = {
  CONSTRUCTION: "construction",
  SPORTS: "sports",
  EVENTS: "events",
  TOOLS: "tools",
  OTHER: "other",
};

async function main(): Promise<void> {
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.equipmentCategory.upsert({
      where: { slug: cat.slug },
      create: { ...cat, iconUrl: "", iconKey: "" },
      update: { name: cat.name, description: cat.description, color: cat.color, sortOrder: cat.sortOrder },
    });
  }

  const slugToId = Object.fromEntries(
    (await prisma.equipmentCategory.findMany({ select: { id: true, slug: true } })).map((c) => [
      c.slug,
      c.id,
    ])
  );

  const hasLegacyColumn = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Equipment' AND column_name = 'category'
    ) AS exists
  `;

  if (hasLegacyColumn[0]?.exists) {
    const rows = await prisma.$queryRaw<{ id: string; category: string }[]>`
      SELECT id, category::text AS category FROM "Equipment" WHERE "categoryId" IS NULL
    `;
    for (const row of rows) {
      const slug = ENUM_TO_SLUG[row.category] ?? "other";
      const categoryId = slugToId[slug];
      if (!categoryId) continue;
      await prisma.equipment.update({
        where: { id: row.id },
        data: { categoryId },
      });
    }
    console.log(`Migrated ${rows.length} equipment row(s) from enum to categoryId`);
  } else {
    const missing = await prisma.equipment.findMany({
      where: { categoryId: null as unknown as string },
      select: { id: true },
    });
    for (const row of missing) {
      await prisma.equipment.update({
        where: { id: row.id },
        data: { categoryId: slugToId.other },
      });
    }
    if (missing.length) console.log(`Set default category for ${missing.length} row(s)`);
  }

  const stillNull = await prisma.equipment.count({ where: { categoryId: null as unknown as string } });
  if (stillNull > 0) {
    throw new Error(`${stillNull} equipment row(s) still missing categoryId`);
  }
  console.log("Category migration complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
