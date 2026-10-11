import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-06-20" });

export async function planFor(email?: string | null): Promise<"free" | "pro"> {
  if (!email) return "free";
  const found = await stripe.customers.list({ email, limit: 1 });
  const customer = found.data[0];
  if (!customer) return "free";
  const subs = await stripe.subscriptions.list({ customer: customer.id, status: "active", limit: 1 });
  return subs.data.length > 0 ? "pro" : "free";
}

export async function checkoutUrl(email: string): Promise<string | null> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.APP_URL}/settings`,
  });
  return session.url;
}
