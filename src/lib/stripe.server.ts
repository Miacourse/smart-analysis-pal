import { planFromProduct, type Plan } from "./billing";

async function stripe(path: string, init?: { method?: string; body?: Record<string, string> }) {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init?.body ? new URLSearchParams(init.body).toString() : null,
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? "Erreur Stripe");
  return json;
}

export async function findCustomerId(email: string): Promise<string | null> {
  const r = await stripe(`customers?email=${encodeURIComponent(email)}&limit=1`);
  return r.data?.[0]?.id ?? null;
}

export async function getProStatus(email: string) {
  const customerId = await findCustomerId(email);
  if (!customerId) return { isPro: false, plan: "free" as Plan, periodEnd: null as string | null };
  const r = await stripe(`subscriptions?customer=${customerId}&status=active&limit=10`);
  let plan: Plan = "free";
  let end: number | undefined;
  for (const s of r.data ?? []) {
    for (const i of s.items?.data ?? []) {
      const p = planFromProduct(i.price?.product);
      if (p === "team" || (p === "pro" && plan === "free")) {
        plan = p;
        end = i.current_period_end ?? s.current_period_end;
      }
    }
  }
  return { isPro: plan !== "free", plan, periodEnd: end ? new Date(end * 1000).toISOString() : null };
}

export async function createCheckoutSession(email: string, priceId: string, origin: string) {
  const customerId = await findCustomerId(email);
  const body: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${origin}/pricing?success=1`,
    cancel_url: `${origin}/pricing?canceled=1`,
  };
  if (customerId) body["customer"] = customerId;
  else body["customer_email"] = email;
  const s = await stripe("checkout/sessions", { method: "POST", body });
  return s.url as string;
}

export async function createPortalSession(email: string, origin: string) {
  const customerId = await findCustomerId(email);
  if (!customerId) throw new Error("Aucun abonnement trouvé.");
  const s = await stripe("billing_portal/sessions", {
    method: "POST",
    body: { customer: customerId, return_url: `${origin}/pricing` },
  });
  return s.url as string;
}
