import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  {
    slug: "construction",
    name: "Construction",
    description: "Heavy machinery, scaffolding, and site equipment.",
    color: "bg-orange-50 text-orange-700",
    sortOrder: 1,
  },
  {
    slug: "sports",
    name: "Sports",
    description: "Gear for training, events, and outdoor activities.",
    color: "bg-green-50 text-green-700",
    sortOrder: 2,
  },
  {
    slug: "events",
    name: "Events",
    description: "Tents, seating, sound, and party rentals.",
    color: "bg-purple-50 text-purple-700",
    sortOrder: 3,
  },
  {
    slug: "tools",
    name: "Tools",
    description: "Power tools and workshop equipment.",
    color: "bg-blue-50 text-blue-700",
    sortOrder: 4,
  },
  {
    slug: "other",
    name: "Other",
    description: "Everything else available to rent.",
    color: "bg-stone-50 text-stone-600",
    sortOrder: 99,
  },
] as const;

async function main(): Promise<void> {
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.equipmentCategory.upsert({
      where: { slug: cat.slug },
      create: { ...cat, iconUrl: "", iconKey: "" },
      update: {
        name: cat.name,
        description: cat.description,
        color: cat.color,
        sortOrder: cat.sortOrder,
      },
    });
  }
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} equipment categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
