"use client";

import { useRouter } from "next/navigation";
import { RecipeForm } from "@/components/recipes/recipe-form";

export default function NewRecipePage() {
  const router = useRouter();

  async function save(values: { title: string; minutes: number }) {
    await fetch("/api/recipes", { method: "POST", body: JSON.stringify(values) });
    router.push("/recipes");
  }

  return <RecipeForm onSubmit={save} />;
}
