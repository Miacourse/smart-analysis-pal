import { planFromProduct, type Plan } from "./billing";

export type ProStatus = { isPro: boolean; plan: Plan; periodEnd: string | null };

type StripeError = { error?: { message?: string } };
type StripeCustomer = { id: string };
type StripeCustomerList = { data?: StripeCustomer[] };
type StripeSubscriptionItem = {
  current_period_end?: number;
  price?: { product?: string };
};
type StripeSubscription = {
  id: string;
  status: string;
  current_period_end?: number;
  customer?: { email?: string };
  items?: { data?: StripeSubscriptionItem[] };
};
type StripeSubscriptionList = { data?: StripeSubscription[] };
type StripeSession = { url?: string };

// Statuts d'abonnement donnant accès au plan payant (essai inclus, impayé toléré).
const BILLABLE_STATUSES = ["active", "trialing", "past_due"] as const;
const BILLABLE_SET = new Set<string>(BILLABLE_STATUSES);

// Cache court pour éviter d'interroger Stripe à chaque chargement de l'interface.
const PRO_STATUS_TTL_MS = 60_000;
const proStatusCache = new Map<string, { at: number; value: ProStatus }>();

async function stripe<T extends object>(
  path: string,
  init?: { method?: string; body?: Record<string, string> },
): Promise<T & StripeError> {
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
  const json = (await res.json()) as T & StripeError;
  if (!res.ok) throw new Error(json.error?.message ?? "Erreur Stripe");
  return json;
}

export async function findCustomerId(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const r = await stripe<StripeCustomerList>(
    `customers?email=${encodeURIComponent(normalized)}&limit=1`,
  );
  return r.data?.[0]?.id ?? null;
}

export async function getProStatus(email: string): Promise<ProStatus> {
  const cacheKey = email.trim().toLowerCase();
  const cached = proStatusCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PRO_STATUS_TTL_MS) return cached.value;

  const value = await fetchProStatus(email);
  proStatusCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

async function fetchProStatus(email: string): Promise<ProStatus> {
  const customerId = await findCustomerId(email);
  if (!customerId) return { isPro: false, plan: "free", periodEnd: null };
  const r = await stripe<StripeSubscriptionList>(`subscriptions?customer=${customerId}&limit=10`);
  let plan: Plan = "free";
  let end: number | undefined;
  for (const s of r.data ?? []) {
    if (!BILLABLE_SET.has(s.status)) continue;
    for (const i of s.items?.data ?? []) {
      const p = planFromProduct(i.price?.product);
      if (p === "team" || (p === "pro" && plan === "free")) {
        plan = p;
        end = i.current_period_end ?? s.current_period_end;
      }
    }
  }
  return {
    isPro: plan !== "free",
    plan,
    periodEnd: end ? new Date(end * 1000).toISOString() : null,
  };
}

export async function createCheckoutSession(opts: {
  email: string;
  priceId: string;
  origin: string;
  userId?: string;
}) {
  const email = opts.email.trim().toLowerCase();
  const customerId = await findCustomerId(email);
  const body: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": "1",
    success_url: `${opts.origin}/pricing?success=1`,
    cancel_url: `${opts.origin}/pricing?canceled=1`,
    allow_promotion_codes: "true",
  };
  if (customerId) body["customer"] = customerId;
  else body["customer_email"] = email;
  if (opts.userId) {
    body["client_reference_id"] = opts.userId;
    body["subscription_data[metadata][user_id]"] = opts.userId;
  }
  const s = await stripe<StripeSession>("checkout/sessions", { method: "POST", body });
  if (!s.url) throw new Error("URL de paiement indisponible.");
  return s.url;
}

export async function cancelSubscriptionsForEmail(email: string) {
  if (!process.env["STRIPE_SECRET_KEY"]) return;
  const customerId = await findCustomerId(email);
  if (!customerId) return;
  const pages = await Promise.all(
    BILLABLE_STATUSES.map((status) =>
      stripe<StripeSubscriptionList>(
        `subscriptions?customer=${customerId}&status=${status}&limit=100`,
      ),
    ),
  );
  const subscriptions = pages.flatMap((page) => page.data ?? []);
  await Promise.all(
    subscriptions.map((subscription) =>
      stripe<StripeSubscription>(`subscriptions/${subscription.id}`, { method: "DELETE" }),
    ),
  );
}

export async function createPortalSession(email: string, origin: string) {
  const customerId = await findCustomerId(email);
  if (!customerId) throw new Error("Aucun abonnement trouvé.");
  const s = await stripe<StripeSession>("billing_portal/sessions", {
    method: "POST",
    body: { customer: customerId, return_url: `${origin}/pricing` },
  });
  if (!s.url) throw new Error("URL du portail indisponible.");
  return s.url;
}

export async function listActivePlansByEmail(): Promise<Map<string, Plan>> {
  const out = new Map<string, Plan>();
  const pages = await Promise.all(
    BILLABLE_STATUSES.map((status) =>
      stripe<StripeSubscriptionList>(
        `subscriptions?status=${status}&limit=100&expand[]=data.customer`,
      ),
    ),
  );
  for (const r of pages) {
    for (const sub of r.data ?? []) {
      const email: string | undefined = sub.customer?.email?.toLowerCase();
      if (!email) continue;
      for (const i of sub.items?.data ?? []) {
        const p = planFromProduct(i.price?.product);
        if (p === "team" || (p === "pro" && out.get(email) !== "team")) out.set(email, p);
      }
    }
  }
  return out;
}
