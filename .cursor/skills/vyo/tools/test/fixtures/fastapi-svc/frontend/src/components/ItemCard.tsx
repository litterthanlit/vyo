import type { ItemPublic } from "@/client";

export function ItemCard({ item }: { item: ItemPublic }) {
  return (
    <article>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </article>
  );
}
