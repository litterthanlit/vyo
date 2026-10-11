"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

// Home: what's in the box, plus a button that asks the assistant for ideas.
export default function HomePage() {
  const [recipes, setRecipes] = useState<{ id: string; title: string }[]>([]);
  const [ideas, setIdeas] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(setRecipes);
  }, []);

  async function suggest() {
    const res = await fetch("/api/suggest", { method: "POST", body: JSON.stringify({ have: recipes.map((r) => r.title) }) });
    setIdeas((await res.json()).ideas);
  }

  if (recipes.length === 0) return <EmptyState title="Your box is empty" />;

  return (
    <section>
      <h1>Welcome back</h1>
      <p>{recipes.length} recipes saved.</p>
      <Button onClick={suggest}>Give me ideas</Button>
      <ul>
        {ideas.map((idea) => (
          <li key={idea}>{idea}</li>
        ))}
      </ul>
    </section>
  );
}
