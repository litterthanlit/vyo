import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ItemsService } from "@/client";

export function AddItem() {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: (title: string) => ItemsService.createItem({ requestBody: { title } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(String(new FormData(e.currentTarget).get("title")));
      }}
    >
      <input name="title" placeholder="New item" />
      <button type="submit">Add</button>
    </form>
  );
}
