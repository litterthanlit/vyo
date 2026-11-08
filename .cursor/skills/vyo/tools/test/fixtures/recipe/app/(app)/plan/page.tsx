import { currentPlan } from "@/lib/plan/query";
import { PlanGrid } from "@/components/plan/plan-grid";
import { ShoppingList } from "@/components/plan/shopping-list";

export default async function PlanPage() {
  const plan = await currentPlan();
  return (
    <section>
      <h1>This week</h1>
      <PlanGrid days={plan.days} />
      <ShoppingList weekOf={plan.week} />
    </section>
  );
}
