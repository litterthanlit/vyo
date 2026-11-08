import Link from "next/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/plan", label: "Plan" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ current }: { current?: string }) {
  return (
    <nav aria-label="Main">
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={cn(item.href === current && "active")}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
