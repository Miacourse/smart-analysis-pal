import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getBillingStatus, startCheckout, openPortal } from "@/lib/billing.functions";
import { FREE_ANALYSIS_LIMIT, FREE_MAX_FILE_MB, PRO_MAX_FILE_MB } from "@/lib/billing";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Tarifs — DA-Copilot" },
      { name: "description", content: "Essai gratuit puis DA-Copilot Pro à 19 €/mois : analyses illimitées et gros fichiers." },
      { property: "og:title", content: "Tarifs — DA-Copilot" },
      { property: "og:description", content: "Essai gratuit puis Pro à 19 €/mois, sans engagement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

type Status = { isPro: boolean; periodEnd: string | null; analysesUsed: number };

function PricingPage() {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    setLoggedIn(!!data.session);
    if (data.session) {
      try {
        setStatus(await getBillingStatus());
      } catch (e) {
        console.error(e);
      }
    }
  }

  useEffect(() => {
    refresh();
    const p = new URLSearchParams(window.location.search);
    if (p.get("success")) toast.success("Paiement confirmé ! Bienvenue dans DA-Copilot Pro.");
    if (p.get("canceled")) toast("Paiement annulé.");
  }, []);

  async function subscribe() {
    if (!loggedIn) return navigate({ to: "/login" });
    setBusy(true);
    try {
      const { url } = await startCheckout();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Paiement indisponible.");
      setBusy(false);
    }
  }

  async function manage() {
    setBusy(true);
    try {
      const { url } = await openPortal();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Portail indisponible.");
      setBusy(false);
    }
  }

  const isPro = status?.isPro ?? false;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="DA-Copilot" width={36} height={36} className="h-9 w-9" />
          <span className="font-display text-lg font-semibold">DA-Copilot</span>
        </Link>
        <Link
          to={loggedIn ? "/chat" : "/login"}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {loggedIn ? "Mon espace" : "Se connecter"}
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-center font-display text-4xl font-bold tracking-tight">Tarifs simples</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Essayez gratuitement, passez Pro quand vous êtes prêt. Sans engagement.
        </p>
        {status && !isPro && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Essai : {Math.min(status.analysesUsed, FREE_ANALYSIS_LIMIT)} / {FREE_ANALYSIS_LIMIT} analyses utilisées
          </p>
        )}

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-8">
            <h2 className="font-display text-lg font-semibold">Essai gratuit</h2>
            <p className="mt-2 font-display text-4xl font-bold">0 €</p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {[`${FREE_ANALYSIS_LIMIT} analyses offertes`, `Fichiers CSV jusqu'à ${FREE_MAX_FILE_MB} Mo`, "Historique des conversations"].map((f) => (
                <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary" />{f}</li>
              ))}
            </ul>
            <Link
              to={loggedIn ? "/chat" : "/login"}
              className="mt-8 block rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold hover:bg-muted"
            >
              {loggedIn ? "Continuer l'essai" : "Commencer gratuitement"}
            </Link>
          </div>

          <div className="rounded-2xl border-2 border-primary bg-card p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Pro</h2>
              {isPro && (
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Votre offre</span>
              )}
            </div>
            <p className="mt-2 font-display text-4xl font-bold">
              19 €<span className="text-base font-normal text-muted-foreground">/mois</span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {["Analyses illimitées", `Fichiers CSV jusqu'à ${PRO_MAX_FILE_MB} Mo`, "Historique illimité", "Support prioritaire"].map((f) => (
                <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary" />{f}</li>
              ))}
            </ul>
            {isPro ? (
              <button onClick={manage} disabled={busy} className="mt-8 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60">
                Gérer mon abonnement
              </button>
            ) : (
              <button onClick={subscribe} disabled={busy} className="mt-8 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {busy ? "Redirection…" : "Devenir Pro"}
              </button>
            )}
            {isPro && status?.periodEnd && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Renouvellement le {new Date(status.periodEnd).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">Paiement sécurisé par Stripe. Annulation en un clic.</p>
      </main>
    </div>
  );
}
