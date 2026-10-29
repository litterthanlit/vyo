// Real files and calls from the recipe planner Vyo tests itself on.
export const CODE = [
  "app/api/recipes/route.ts", "export async function POST", "prisma.recipe.create", "app/(app)/plan/page.tsx",
  "components/plan/shopping-list.tsx", "app/api/suggest/route.ts", "suggestRecipes(have)", "lib/ai/prompts.ts",
  "app/api/cron/weekly-plan/route.ts", "prisma/schema.prisma", "app/(app)/recipes/[id]/page.tsx", "app/(app)/settings/page.tsx",
];

/** A row of code, at least `len` characters, offset so neighbouring rows differ. */
export const codeRow = (r: number, len: number) => {
  let s = "";
  for (let k = 0; s.length < len; k++) s += CODE[(r * 5 + k) % CODE.length] + "   ";
  return s.slice((r * 7) % 9, ((r * 7) % 9) + len);
};
