import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * No default categories or catalog data — create categories via the admin dashboard API.
 * Default admin account seeding runs on rental-admin-api startup (see rental-admin-api/src/seed/adminSeed.ts).
 */
async function main(): Promise<void> {
  const count = await prisma.equipmentCategory.count();
  console.log(
    count > 0
      ? `Database has ${count} equipment categor(ies) from admin API.`
      : "No equipment categories yet. Add them in the admin dashboard under Categories."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
