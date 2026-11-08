import { Button } from "@/components/ui/button";
import { RecipeCard, type RecipeView } from "./recipe-card";

export function RecipeList({ recipes }: { recipes: RecipeView[] }) {
  if (recipes.length === 0) return <p>No recipes yet.</p>;
  return (
    <div className="recipe-list">
      {recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} />
      ))}
      <Button type="button">Load more</Button>
    </div>
  );
}
