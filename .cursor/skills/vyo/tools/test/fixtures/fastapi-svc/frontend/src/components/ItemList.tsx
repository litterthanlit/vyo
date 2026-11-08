import type { ItemPublic } from "@/client";
import { ItemCard } from "./ItemCard";

export function ItemList({ items }: { items: ItemPublic[] }) {
  if (items.length === 0) return <p>Nothing saved yet.</p>;
  return (
    <div>
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
