"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RecipeList } from "@/components/recipes/recipe-list";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]);

  useEffect(() => {
    fetch("/api/recipes").then((r) => r.json()).then(setRecipes);
  }, []);

  return (
    <section>
      <h1>All recipes</h1>
      <Link href="/recipes/new">Add a recipe</Link>
      <RecipeList recipes={recipes} />
    </section>
  );
}
