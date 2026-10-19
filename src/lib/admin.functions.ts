import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminContext = { supabase: any; userId: string };

async function assertAdmin(context: AdminContext) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Accès réservé à l’administrateur.");
}

const USER_ID = /^[0-9a-f-]{36}$/i;

export const adminSetComp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; plan: "none" | "pro" | "team" }) => {
    if (!USER_ID.test(d?.userId ?? "")) throw new Error("Utilisateur invalide.");
    const plan = d?.plan === "pro" || d?.plan === "team" ? d.plan : "none";
    return { userId: d.userId, plan };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: data.userId,
        comp_plan: data.plan === "none" ? null : data.plan,
        comp_expires_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error("Mise à jour de l’offre impossible.");
    return { ok: true };
  });

export const adminAddBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; delta: number }) => {
    if (!USER_ID.test(d?.userId ?? "")) throw new Error("Utilisateur invalide.");
    const delta = Math.trunc(Number(d?.delta));
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1000) throw new Error("Valeur invalide.");
    return { userId: d.userId, delta };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("subscriptions")
      .select("bonus_analyses")
      .eq("user_id", data.userId)
      .maybeSingle();
    const next = Math.max(0, (row?.bonus_analyses ?? 0) + data.delta);
    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      { user_id: data.userId, bonus_analyses: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw new Error("Mise à jour du quota impossible.");
    return { ok: true, bonus: next };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; isAdmin: boolean }) => {
    if (!USER_ID.test(d?.userId ?? "")) throw new Error("Utilisateur invalide.");
    return { userId: d.userId, isAdmin: d.isAdmin === true };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (!data.isAdmin && data.userId === context.userId) {
      throw new Error("Vous ne pouvez pas retirer votre propre accès administrateur.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.isAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error("Attribution impossible.");
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error("Retrait impossible.");
    }
    return { ok: true };
  });
