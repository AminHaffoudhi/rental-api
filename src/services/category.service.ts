import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

export const categoryPublicSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  iconUrl: true,
  color: true,
  sortOrder: true,
  isActive: true,
} as const;

export async function listActiveCategories() {
  return prisma.equipmentCategory.findMany({
    where: { isActive: true },
    select: categoryPublicSelect,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getCategoryById(id: string) {
  const row = await prisma.equipmentCategory.findFirst({
    where: { id, isActive: true },
    select: categoryPublicSelect,
  });
  if (!row) {
    throw new NotFoundError("Category");
  }
  return row;
}

export async function resolveCategoryId(categoryId?: string, categorySlug?: string): Promise<string | undefined> {
  if (categoryId) {
    const byId = await prisma.equipmentCategory.findFirst({
      where: { id: categoryId, isActive: true },
      select: { id: true },
    });
    if (!byId) throw new NotFoundError("Category");
    return byId.id;
  }
  if (categorySlug) {
    const slug = categorySlug.trim().toLowerCase();
    const bySlug = await prisma.equipmentCategory.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!bySlug) throw new NotFoundError("Category");
    return bySlug.id;
  }
  return undefined;
}

export async function assertCategoryId(categoryId: string): Promise<void> {
  const row = await prisma.equipmentCategory.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true },
  });
  if (!row) {
    throw new NotFoundError("Category");
  }
}
