import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean };

export function Button({ className, asChild: _asChild, ...rest }: Props) {
  return <button className={cn("btn", className)} {...rest} />;
}
