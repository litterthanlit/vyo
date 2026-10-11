import { prisma } from "@/lib/db";

export async function listRecipes() {
  return prisma.recipe.findMany({ orderBy: { createdAt: "desc" }, include: { ingredients: true } });
}

export async function getRecipe(id: string) {
  return prisma.recipe.findUnique({ where: { id }, include: { ingredients: true } });
}

export async function recipeCount() {
  return prisma.recipe.count();
}
