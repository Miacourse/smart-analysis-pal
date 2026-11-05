import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { DatelloLogo } from "@/components/brand/DatelloLogo";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Datello" },
      { name: "description", content: "Connectez-vous à Datello pour analyser vos données." },
      { property: "og:title", content: "Connexion — Datello" },
      { property: "og:description", content: "Accédez à votre assistant d'analyse de données." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function LoginPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Detecte le retour depuis le lien de réinitialisation envoyé par email.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setRecovering(true);
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/chat" });
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/chat" });
        } else {
          toast.success(t("Compte créé ! Vérifiez votre email pour confirmer votre inscription."));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/invalid login credentials/i.test(msg)) {
        toast.error(
          t(
            "Email ou mot de passe incorrect. Si vous vous êtes inscrit avec Google, utilisez « Continuer avec Google ».",
          ),
        );
      } else if (/email not confirmed/i.test(msg)) {
        toast.error(t("Confirmez d'abord votre email via le lien reçu."));
      } else if (/already registered/i.test(msg)) {
        toast.error(
          t("Un compte existe déjà avec cet email. Connectez-vous (ou utilisez Google)."),
        );
      } else {
        toast.error(msg || t("Une erreur est survenue."));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    if (!email.trim()) {
      toast.error(t("Renseignez d'abord votre adresse email, puis cliquez à nouveau."));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success(t("Email de réinitialisation envoyé. Vérifiez votre boîte de réception."));
    } catch {
      toast.error(t("Envoi impossible. Réessayez dans un instant."));
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("Mot de passe mis à jour."));
      navigate({ to: "/chat" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Mise à jour impossible."));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
      toast.error(
        t(
          "La connexion Google n'est disponible que sur le site Lovable (preview ou publié). En local, utilisez email + mot de passe.",
        ),
      );
      return;
    }
    // Ferme toute session existante puis force Google à demander quel compte utiliser.
    await supabase.auth.signOut();
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      toast.error(t("La connexion Google a échoué."));
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/chat" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid-paper bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <DatelloLogo height={48} />
          <h1 className="mt-3 font-display text-xl font-bold">
            {recovering
              ? t("Nouveau mot de passe")
              : mode === "signin"
                ? t("Bon retour")
                : t("Créer un compte")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {recovering
              ? t("Choisissez un nouveau mot de passe pour votre compte.")
              : mode === "signin"
                ? t("Connectez-vous pour retrouver vos analyses.")
                : t("5 analyses offertes, sans carte bancaire.")}
          </p>
        </div>

        {recovering ? (
          <form onSubmit={handleNewPassword} className="space-y-3">
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("Nouveau mot de passe (6 caractères min.)")}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? t("Patientez…") : t("Mettre à jour le mot de passe")}
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {t("Continuer avec Google")}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              {t("ou")}
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleEmail} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("Adresse email")}
                className={inputClass}
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("Mot de passe (6 caractères min.)")}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {loading
                  ? t("Patientez…")
                  : mode === "signin"
                    ? t("Se connecter")
                    : t("S'inscrire")}
              </button>
            </form>

            {mode === "signin" && (
              <p className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={loading}
                  className="text-xs text-muted-foreground hover:underline disabled:opacity-60"
                >
                  {resetSent ? t("Email envoyé — renvoyer le lien") : t("Mot de passe oublié ?")}
                </button>
              </p>
            )}

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signin" ? t("Pas encore de compte ?") : t("Déjà inscrit ?")}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="font-semibold text-primary hover:underline"
              >
                {mode === "signin" ? t("S'inscrire") : t("Se connecter")}
              </button>
            </p>
          </>
        )}

        <p className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:underline">
            ← {t("Retour à l'accueil")}
          </Link>
        </p>
      </div>
    </div>
  );
}
