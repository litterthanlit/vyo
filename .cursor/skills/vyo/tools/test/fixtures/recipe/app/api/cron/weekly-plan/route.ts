import { NextResponse } from "next/server";
import { buildWeeklyPlans } from "@/lib/plan/build";
import { sendPlanEmail } from "@/lib/email";

// Called by Vercel Cron every Monday morning (see vercel.json).
export async function GET() {
  const plans = await buildWeeklyPlans();
  for (const plan of plans) await sendPlanEmail(plan.userEmail, plan);
  return NextResponse.json({ built: plans.length });
}
