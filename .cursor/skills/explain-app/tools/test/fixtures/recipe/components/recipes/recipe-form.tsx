"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IngredientRow } from "./ingredient-row";

export function RecipeForm({ onSubmit }: { onSubmit: (v: { title: string; minutes: number }) => void }) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [rows, setRows] = useState([{ name: "", quantity: "" }]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, minutes });
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Recipe name" />
      <Input type="number" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
      {rows.map((row, i) => (
        <IngredientRow key={i} row={row} onChange={(next) => setRows(rows.map((r, j) => (j === i ? next : r)))} />
      ))}
      <Button type="submit">Save recipe</Button>
    </form>
  );
}
