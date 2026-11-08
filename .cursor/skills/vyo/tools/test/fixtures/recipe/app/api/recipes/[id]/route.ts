import { NextResponse } from "next/server";
import { getRecipe } from "@/lib/recipes/query";
import { updateRecipe, removeRecipe } from "@/lib/recipes/mutations";
import { parseRecipe } from "@/lib/recipes/schema";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const recipe = await getRecipe(params.id);
  return recipe ? NextResponse.json(recipe) : new NextResponse(null, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return NextResponse.json(await updateRecipe(params.id, parseRecipe(await req.json())));
}

export const DELETE = async (_req: Request, { params }: Ctx) => {
  await removeRecipe(params.id);
  return new NextResponse(null, { status: 204 });
};
