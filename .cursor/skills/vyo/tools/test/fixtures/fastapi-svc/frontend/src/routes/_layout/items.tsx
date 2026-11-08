import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ItemsService } from "../../client";
import { AddItem } from "@/components/AddItem";
import { ItemList } from "@/components/ItemList";

export const Route = createFileRoute("/_layout/items")({
  component: Items,
});

function Items() {
  const { data } = useQuery({ queryKey: ["items"], queryFn: () => ItemsService.readItems() });
  return (
    <section>
      <AddItem />
      <ItemList items={data?.data ?? []} />
    </section>
  );
}
