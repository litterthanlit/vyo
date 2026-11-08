export type RecipeInput = {
  title: string;
  minutes: number;
  notes?: string;
  ingredients: { name: string; quantity: string }[];
};

// Checks the shape of a request body and fills in defaults.
export function parseRecipe(body: unknown): RecipeInput {
  const b = (body ?? {}) as Partial<RecipeInput>;
  if (!b.title || typeof b.title !== "string") throw new Error("A recipe needs a title");
  return {
    title: b.title.trim(),
    minutes: Number.isFinite(b.minutes) ? Number(b.minutes) : 30,
    notes: b.notes,
    ingredients: Array.isArray(b.ingredients) ? b.ingredients : [],
  };
}
