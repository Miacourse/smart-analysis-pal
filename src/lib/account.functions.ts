import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { confirmation: string }) => {
    if (data?.confirmation !== "SUPPRIMER") throw new Error("Confirmation invalide.");
    return { confirmation: data.confirmation };
  })
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userError } = await context.supabase.auth.getUser();
    if (userError || !userData.user?.email) throw new Error("Compte introuvable.");

    try {
      const { cancelSubscriptionsForEmail } = await import("./stripe.server");
      await cancelSubscriptionsForEmail(userData.user.email);
    } catch {
      throw new Error("Impossible de résilier l’abonnement. Réessayez ou contactez le support.");
    }

    const { error: threadsError } = await supabaseAdmin
      .from("threads")
      .delete()
      .eq("user_id", context.userId);
    if (threadsError) throw new Error("Suppression des conversations impossible.");

    const { error: subscriptionsError } = await supabaseAdmin
      .from("subscriptions")
      .delete()
      .eq("user_id", context.userId);
    if (subscriptionsError) throw new Error("Suppression de l’abonnement impossible.");

    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", context.userId);
    if (rolesError) throw new Error("Suppression des accès impossible.");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Suppression du compte impossible.");

    return { ok: true };
  });
