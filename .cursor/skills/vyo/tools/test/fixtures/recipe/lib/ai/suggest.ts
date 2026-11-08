import OpenAI from "openai";
import { tool } from "ai";
import { ideasPrompt, SYSTEM_PROMPT } from "./prompts";
import { MODEL, trimIdeas } from "./client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Things the assistant may look up while it thinks.
export const tools = {
  searchRecipes: tool({
    description: "Search the saved recipes by title",
    parameters: { query: "string" },
    execute: async ({ query }: { query: string }) => ({ query, matches: [] as string[] }),
  }),
  saveIdea: tool({
    description: "Remember an idea for later",
    parameters: { idea: "string" },
    execute: async ({ idea }: { idea: string }) => ({ saved: idea }),
  }),
};

export async function suggestRecipes(have: string[]): Promise<string[]> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: ideasPrompt(have) },
    ],
  });
  return trimIdeas(res.choices[0]?.message?.content ?? "");
}
