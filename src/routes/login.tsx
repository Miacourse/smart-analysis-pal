import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — DA-Copilot" },
      { name: "description", content: "Connectez-vous à DA-Copilot pour analyser vos données." },
      { property: "og:title", content: "Connexion — DA-Copilot" },
      { property: "og:description", content: "Accédez à votre assistant d'analyse de données." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
          toast.success("Compte créé ! Vérifiez votre email pour confirmer votre inscription.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("La connexion Google a échoué.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/chat" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid-paper bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logo} alt="DA-Copilot" width={48} height={48} className="h-12 w-12" />
          <h1 className="mt-3 font-display text-xl font-bold">
            {mode === "signin" ? "Bon retour" : "Créer un compte"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Connectez-vous pour retrouver vos analyses."
              : "20 analyses offertes, sans carte bancaire."}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Continuer avec Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          ou
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Adresse email"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe (6 caractères min.)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Patientez…" : mode === "signin" ? "Se connecter" : "S'inscrire"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-primary hover:underline"
          >
            {mode === "signin" ? "S'inscrire" : "Se connecter"}
          </button>
        </p>

        <p className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:underline">
            ← Retour à l'accueil
          </Link>
        </p>
      </div>
    </div>
  );
}
