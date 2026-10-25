import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activeCompPlan, FREE_ANALYSIS_LIMIT, PLAN_PRICES, type PaidPlan } from "./billing";

function originOf() {
  return getRequestHeader("origin") ?? "https://da-copilot.lovable.app";
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
      .select("analyses_used, comp_plan, comp_expires_at, bonus_analyses")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { count } = await context.supabase
      .from("messages")
      .select("id, threads!inner(user_id)", { count: "exact", head: true })
      .eq("role", "assistant")
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
    const bonus = sub?.bonus_analyses ?? 0;
    const { data: adminFlag } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const isAdmin = adminFlag === true;
    const compPlan = activeCompPlan(sub?.comp_plan, sub?.comp_expires_at);
    const status = isAdmin
      ? { isPro: true, plan: "team" as const, periodEnd: null }
      : compPlan
        ? { isPro: true, plan: compPlan, periodEnd: sub?.comp_expires_at ?? null }
        : await getProStatus(email);
    return {
      ...status,
      isAdmin,
      analysesUsed: sub?.analyses_used ?? 0,
      analysesThisMonth: count ?? 0,
      freeLimit: FREE_ANALYSIS_LIMIT + bonus,
    };
  });

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan?: PaidPlan } | undefined) => ({
    plan: data?.plan === "team" ? ("team" as const) : ("pro" as const),
  }))
  .handler(async ({ context, data }) => {
    const { createCheckoutSession } = await import("./stripe.server");
    const email = await emailOf(context.supabase);
    return {
      url: await createCheckoutSession({
        email,
        priceId: PLAN_PRICES[data.plan].priceId,
        origin: originOf(),
        userId: context.userId,
      }),
    };
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
    const [usersRes, subs, threadsRes, msgs, roles, plans, visitsRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 500 }),
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, analyses_used, bonus_analyses, comp_plan, comp_expires_at, updated_at"),
      supabaseAdmin.from("threads").select("id, user_id, title, dataset_name, updated_at").order("updated_at", { ascending: false }).limit(500),
      supabaseAdmin.from("messages").select("created_at, thread_id").eq("role", "assistant").gte("created_at", since30).limit(5000),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      listActivePlansByEmail().catch(() => new Map<string, "free" | "pro" | "team">()),
      (supabaseAdmin as any)
        .from("app_visits")
        .select("country, created_at")
        .gte("created_at", since30)
        .limit(20000)
        .then((res: { data: Array<{ country: string | null; created_at: string }> | null; error: unknown }) => res)
        .catch(() => ({ data: [], error: true })),
    ]);
    const subRows = subs.data ?? [];
    const used = new Map(subRows.map((s) => [s.user_id, s.analyses_used]));
    const bonusByUser = new Map(subRows.map((s) => [s.user_id, s.bonus_analyses ?? 0]));
    const compByUser = new Map<string, PaidPlan>();
    for (const s of subRows) {
      const comp = activeCompPlan(s.comp_plan, s.comp_expires_at, now);
      if (comp) compByUser.set(s.user_id, comp);
    }
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
    const users = authUsers.map((u) => {
      const stripePlan = plans.get((u.email ?? "").toLowerCase()) ?? "free";
      const compPlan = compByUser.get(u.id) ?? null;
      return {
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? null,
        analysesUsed: used.get(u.id) ?? 0,
        analyses30d: lastMonth.get(u.id) ?? 0,
        conversations: threads.filter((t) => t.user_id === u.id).length,
        plan: compPlan ?? stripePlan,
        compPlan,
        bonus: bonusByUser.get(u.id) ?? 0,
        paid: stripePlan !== "free",
        isAdmin: admins.has(u.id),
      };
    });
    users.sort((a, b) => b.analysesUsed - a.analysesUsed);
    const pro = users.filter((u) => u.plan === "pro").length;
    const team = users.filter((u) => u.plan === "team").length;
    let paidPro = 0;
    let paidTeam = 0;
    for (const p of plans.values()) {
      if (p === "team") paidTeam++;
      else if (p === "pro") paidPro++;
    }
    const today = new Date(now).toISOString().slice(0, 10);
    const countryCounts = new Map<string, number>();
    const visitDays = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      visitDays.set(new Date(now - i * 86400000).toISOString().slice(0, 10), 0);
    }
    for (const visit of visitsRes.data ?? []) {
      const code = (visit.country ?? "??").toUpperCase();
      countryCounts.set(code, (countryCounts.get(code) ?? 0) + 1);
      const day = visit.created_at.slice(0, 10);
      if (visitDays.has(day)) visitDays.set(day, (visitDays.get(day) ?? 0) + 1);
    }
    return {
      totalUsers: users.length,
      totalThreads: threads.length,
      analysesToday: perDay.get(today) ?? 0,
      totalAnalyses: users.reduce((n, u) => n + u.analysesUsed, 0),
      proCount: pro,
      teamCount: team,
      mrr: paidPro * PLAN_PRICES.pro.eur + paidTeam * PLAN_PRICES.team.eur,
      nearLimit: users.filter((u) => u.plan === "free" && u.analysesUsed >= FREE_ANALYSIS_LIMIT + u.bonus - 1).length,
      perDay: [...perDay.entries()].map(([day, count]) => ({ day, count })),
      visitsTotal: visitsRes.data?.length ?? 0,
      visitsToday: visitDays.get(today) ?? 0,
      visitsByDay: [...visitDays.entries()].map(([day, count]) => ({ day, count })),
      visitsByCountry: [...countryCounts.entries()]
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30),
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
