import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Day } from "./plan-grid";

export function PlanDay({ day }: { day: Day }) {
  const empty = day.recipes.length === 0;
  return (
    <div className={cn("plan-day", empty && "plan-day--empty")}>
      <strong>{day.name}</strong>
      {empty ? <Badge>Free night</Badge> : day.recipes.map((r) => <span key={r}>{r}</span>)}
    </div>
  );
}
