import { prisma } from "@/lib/db";
import { listRecipes } from "@/lib/recipes/query";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Picks a recipe for each weeknight and saves it as this week's plan for every user.
export async function buildWeeklyPlans() {
  const recipes = await listRecipes();
  const users = await prisma.user.findMany();
  const week = new Date();
  const plans = [];
  for (const user of users) {
    const days = DAYS.map((name, i) => ({ name, recipes: i < 5 && recipes.length ? [recipes[i % recipes.length].title] : [] }));
    await prisma.mealPlan.upsert({
      where: { userId_week: { userId: user.id, week } },
      create: { userId: user.id, week, days },
      update: { days },
    });
    plans.push({ userEmail: user.email, week: week.toISOString().slice(0, 10), days });
  }
  return plans;
}
