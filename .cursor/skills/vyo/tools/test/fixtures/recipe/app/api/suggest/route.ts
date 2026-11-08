import { NextResponse } from "next/server";
import { suggestRecipes } from "@/lib/ai/suggest";

export async function POST(req: Request) {
  const { have } = await req.json();
  return NextResponse.json({ ideas: await suggestRecipes(have ?? []) });
}
