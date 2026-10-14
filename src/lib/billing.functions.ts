import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FREE_ANALYSIS_LIMIT, PLAN_PRICES, type PaidPlan } from "./billing";

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

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Accès réservé à l’administrateur.");
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listActivePlansByEmail } = await import("./stripe.server");
    const now = Date.now();
    const since30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    const [usersRes, subs, threadsRes, msgs, roles, plans] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 500 }),
      supabaseAdmin.from("subscriptions").select("user_id, analyses_used, updated_at"),
      supabaseAdmin.from("threads").select("id, user_id, title, dataset_name, updated_at").order("updated_at", { ascending: false }).limit(500),
      supabaseAdmin.from("messages").select("created_at, thread_id").eq("role", "assistant").gte("created_at", since30).limit(5000),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      listActivePlansByEmail().catch(() => new Map<string, "free" | "pro" | "team">()),
    ]);
    const used = new Map((subs.data ?? []).map((s) => [s.user_id, s.analyses_used]));
    const admins = new Set((roles.data ?? []).map((r) => r.user_id));
    const threads = threadsRes.data ?? [];
    const threadOwner = new Map(threads.map((t) => [t.id, t.user_id]));
    const lastMonth = new Map<string, number>();
    const perDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) perDay.set(new Date(now - i * 86400000).toISOString().slice(0, 10), 0);
    for (const m of msgs.data ?? []) {
      const day = m.created_at.slice(0, 10);
      if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
      const owner = threadOwner.get(m.thread_id);
      if (owner) lastMonth.set(owner, (lastMonth.get(owner) ?? 0) + 1);
    }
    const authUsers = usersRes.data?.users ?? [];
    const emailOfId = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));
    const users = authUsers.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      analysesUsed: used.get(u.id) ?? 0,
      analyses30d: lastMonth.get(u.id) ?? 0,
      conversations: threads.filter((t) => t.user_id === u.id).length,
      plan: plans.get((u.email ?? "").toLowerCase()) ?? ("free" as const),
      isAdmin: admins.has(u.id),
    }));
    users.sort((a, b) => b.analysesUsed - a.analysesUsed);
    const pro = users.filter((u) => u.plan === "pro").length;
    const team = users.filter((u) => u.plan === "team").length;
    const today = new Date(now).toISOString().slice(0, 10);
    return {
      totalUsers: users.length,
      totalThreads: threads.length,
      analysesToday: perDay.get(today) ?? 0,
      totalAnalyses: users.reduce((n, u) => n + u.analysesUsed, 0),
      proCount: pro,
      teamCount: team,
      mrr: pro * PLAN_PRICES.pro.eur + team * PLAN_PRICES.team.eur,
      nearLimit: users.filter((u) => u.plan === "free" && u.analysesUsed >= FREE_ANALYSIS_LIMIT - 1).length,
      perDay: [...perDay.entries()].map(([day, count]) => ({ day, count })),
      users,
      recentThreads: threads.slice(0, 15).map((t) => ({ id: t.id, title: t.title, dataset: t.dataset_name, updatedAt: t.updated_at, email: emailOfId.get(t.user_id) ?? "" })),
    };
  });

export const adminResetQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(d?.userId ?? "")) throw new Error("Utilisateur invalide.");
    return { userId: d.userId };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert({ user_id: data.userId, analyses_used: 0, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error("Réinitialisation impossible.");
    return { ok: true };
  });
