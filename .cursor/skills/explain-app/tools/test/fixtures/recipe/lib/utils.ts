// Joins class names, skipping anything falsy.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}
