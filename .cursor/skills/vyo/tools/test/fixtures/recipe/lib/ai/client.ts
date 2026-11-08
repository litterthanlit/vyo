export const MODEL = "gpt-4o-mini";

export const LIMITS = { maxIdeas: 5, timeoutMs: 15000 };

export function trimIdeas(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, LIMITS.maxIdeas);
}
