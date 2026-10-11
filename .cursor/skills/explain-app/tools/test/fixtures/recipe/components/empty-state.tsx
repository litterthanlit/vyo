import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmptyState({ title }: { title: string }) {
  return (
    <Card>
      <Badge>Nothing here yet</Badge>
      <h2>{title}</h2>
      <Button>Add your first recipe</Button>
    </Card>
  );
}
