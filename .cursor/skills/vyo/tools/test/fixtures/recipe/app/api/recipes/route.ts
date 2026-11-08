import { NextResponse } from "next/server";
import { listRecipes } from "@/lib/recipes/query";
import { createRecipe } from "@/lib/recipes/mutations";
import { parseRecipe } from "@/lib/recipes/schema";

export async function GET() {
  return NextResponse.json(await listRecipes());
}

export async function POST(req: Request) {
  const input = parseRecipe(await req.json());
  return NextResponse.json(await createRecipe(input), { status: 201 });
}
