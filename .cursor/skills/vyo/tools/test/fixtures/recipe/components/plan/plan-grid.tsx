import { Card } from "@/components/ui/card";
import { PlanDay } from "./plan-day";

export type Day = { name: string; recipes: string[] };

export function PlanGrid({ days }: { days: Day[] }) {
  return (
    <Card>
      <div className="plan-grid">
        {days.map((d) => (
          <PlanDay key={d.name} day={d} />
        ))}
      </div>
    </Card>
  );
}
