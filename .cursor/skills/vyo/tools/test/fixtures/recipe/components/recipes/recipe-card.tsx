import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type RecipeView = { id: string; title: string; minutes: number; ingredients?: { name: string; quantity: string }[] };

export function RecipeCard({ recipe }: { recipe: RecipeView }) {
  return (
    <Card>
      <CardTitle>{recipe.title}</CardTitle>
      <Badge>{recipe.minutes} min</Badge>
      <ul>
        {(recipe.ingredients ?? []).map((i) => (
          <li key={i.name}>
            {i.quantity} {i.name}
          </li>
        ))}
      </ul>
    </Card>
  );
}
