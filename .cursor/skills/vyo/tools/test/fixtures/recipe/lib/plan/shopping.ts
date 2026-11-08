import { prisma } from "@/lib/db";
// import { oldTotals } from "@/lib/plan/old-totals";   (kept for reference; the file is gone)
import { formatMinutes } from "@/lib/utils";
/* import legacy from "./legacy-list"; */

// Adds up what you need to buy for a list of recipes.
export async function shoppingFor(recipeIds: string[]) {
  const rows = await prisma.ingredient.findMany({ where: { recipeId: { in: recipeIds } } });
  const totals = new Map<string, string[]>();
  for (const row of rows) totals.set(row.name, [...(totals.get(row.name) ?? []), row.quantity]);
  return [...totals].map(([name, quantities]) => ({ name, quantities }));
}

export function cookingTime(minutes: number[]) {
  return formatMinutes(minutes.reduce((a, b) => a + b, 0));
}
