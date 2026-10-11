import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPlanEmail(to: string, plan: { week: string; days: { name: string; recipes: string[] }[] }) {
  const lines = plan.days.map((d) => `${d.name}: ${d.recipes.join(", ") || "free night"}`);
  await resend.emails.send({
    from: "Pantry <hello@pantry.example>",
    to,
    subject: `Your week of ${plan.week}`,
    text: lines.join("\n"),
  });
}
