export const SYSTEM_PROMPT = `You are a friendly kitchen helper.
Suggest dinners that use what the person already has, and keep each idea to one line.`;

export function ideasPrompt(have: string[]): string {
  return have.length ? `I already cook: ${have.join(", ")}. What else could I make this week?` : "What could I make this week?";
}
