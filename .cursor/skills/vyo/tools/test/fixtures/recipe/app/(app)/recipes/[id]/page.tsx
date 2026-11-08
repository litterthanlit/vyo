import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/recipes/query";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { Card } from "@/components/ui/card";

export default async function RecipePage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);
  if (!recipe) notFound();
  return (
    <Card>
      <RecipeCard recipe={recipe} />
    </Card>
  );
}
