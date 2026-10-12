import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_PRICES, type PaidPlan } from "./billing";

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
    const { count } = await context.supabase
      .from("messages")
      .select("id, threads!inner(user_id)", { count: "exact", head: true })
      .eq("role", "assistant")
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
    const status = await getProStatus(email);
    return { ...status, analysesUsed: sub?.analyses_used ?? 0, analysesThisMonth: count ?? 0 };
  });

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan?: PaidPlan } | undefined) => ({
    plan: data?.plan === "team" ? ("team" as const) : ("pro" as const),
  }))
  .handler(async ({ context, data }) => {
    const { createCheckoutSession } = await import("./stripe.server");
    const email = await emailOf(context.supabase);
    return { url: await createCheckoutSession(email, PLAN_PRICES[data.plan].priceId, originOf()) };
  });

export const openPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createPortalSession } = await import("./stripe.server");
    const email = await emailOf(context.supabase);
    return { url: await createPortalSession(email, originOf()) };
  });

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: data === true };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) throw new Error("Accès réservé à l’administrateur.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [usersRes, subs, threads, today] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
      supabaseAdmin.from("subscriptions").select("user_id, analyses_used, updated_at"),
      supabaseAdmin.from("threads").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("messages").select("id", { count: "exact", head: true }).eq("role", "assistant").gte("created_at", since),
    ]);
    const used = new Map((subs.data ?? []).map((s) => [s.user_id, s]));
    const users = (usersRes.data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      analysesUsed: used.get(u.id)?.analyses_used ?? 0,
    }));
    users.sort((a, b) => b.analysesUsed - a.analysesUsed);
    return {
      totalUsers: users.length,
      totalThreads: threads.count ?? 0,
      analysesToday: today.count ?? 0,
      totalAnalyses: users.reduce((n, u) => n + u.analysesUsed, 0),
      users,
    };
  });
