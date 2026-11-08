"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ShoppingList({ weekOf }: { weekOf: string }) {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  return (
    <section aria-label={`Shopping list for ${weekOf}`}>
      <ul>
        {items.map((item) => (
          <li key={item} className={cn("shopping-item")}>
            {item}
          </li>
        ))}
      </ul>
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} />
      <Button
        onClick={() => {
          setItems([...items, draft]);
          setDraft("");
        }}
      >
        Add
      </Button>
    </section>
  );
}
