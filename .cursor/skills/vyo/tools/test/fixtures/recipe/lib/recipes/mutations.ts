import { prisma } from "@/lib/db";
import type { RecipeInput } from "./schema";

const OWNER = "demo-user";

export async function createRecipe(input: RecipeInput) {
  const { ingredients, ...rest } = input;
  const recipe = await prisma.recipe.create({ data: { ...rest, ownerId: OWNER } });
  if (ingredients.length > 0) {
    await prisma.ingredient.createMany({ data: ingredients.map((i) => ({ ...i, recipeId: recipe.id })) });
  }
  return recipe;
}

export async function updateRecipe(id: string, input: RecipeInput) {
  const { ingredients: _skip, ...rest } = input;
  return prisma.recipe.update({ where: { id }, data: rest });
}

export async function removeRecipe(id: string) {
  await prisma.ingredient.deleteMany({ where: { recipeId: id } });
  await prisma.recipe.delete({ where: { id } });
}
