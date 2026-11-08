import { Input } from "@/components/ui/input";

type Row = { name: string; quantity: string };

export function IngredientRow({ row, onChange }: { row: Row; onChange: (next: Row) => void }) {
  return (
    <div className="ingredient-row">
      <Input value={row.quantity} onChange={(e) => onChange({ ...row, quantity: e.target.value })} placeholder="2 cups" />
      <Input value={row.name} onChange={(e) => onChange({ ...row, name: e.target.value })} placeholder="flour" />
    </div>
  );
}
