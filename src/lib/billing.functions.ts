import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRO_PRICE_ID } from "./billing";

function originOf() {
  return getRequestHeader("origin") ?? "https://smart-analysis-pal.lovable.app";
}

async function emailOf(supabase: any): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) throw new Error("Email introuvable.");
  return data.user.email;
}

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getProStatus } = await import("./stripe.server");
    const email = await emailOf(context.supabase);
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("analyses_used")
      .eq("user_id", context.userId)
      .maybeSingle();
    const status = await getProStatus(email);
    return { ...status, analysesUsed: sub?.analyses_used ?? 0 };
  });

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createCheckoutSession } = await import("./stripe.server");
    const email = await emailOf(context.supabase);
    return { url: await createCheckoutSession(email, PRO_PRICE_ID, originOf()) };
  });

export const openPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createPortalSession } = await import("./stripe.server");
    const email = await emailOf(context.supabase);
    return { url: await createPortalSession(email, originOf()) };
  });
