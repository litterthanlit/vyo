import { prisma } from "@/lib/db";
import type { Day } from "@/components/plan/plan-grid";

function startOfWeek(d = new Date()) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function currentPlan(): Promise<{ week: string; days: Day[] }> {
  const week = startOfWeek();
  const found = await prisma.mealPlan.findFirst({ where: { week } });
  return { week: week.toISOString().slice(0, 10), days: (found?.days as Day[] | undefined) ?? [] };
}

export async function recentPlans(limit = 4) {
  return prisma.mealPlan.findMany({ orderBy: { week: "desc" }, take: limit });
}
