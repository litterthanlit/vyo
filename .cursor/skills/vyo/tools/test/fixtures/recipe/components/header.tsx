import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Header({ className }: { className?: string }) {
  return (
    <header className={cn("site-header", className)}>
      <Link href="/">Pantry</Link>
      <Input placeholder="Search recipes" aria-label="Search recipes" />
      <Button asChild>
        <Link href="/recipes/new">New recipe</Link>
      </Button>
    </header>
  );
}
