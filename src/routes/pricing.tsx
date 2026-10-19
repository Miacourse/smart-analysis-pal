import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getBillingStatus, startCheckout, openPortal } from "@/lib/billing.functions";
import { FREE_ANALYSIS_LIMIT, FREE_MAX_FILE_MB, FREE_MAX_ROWS, PRO_MAX_FILE_MB, PRO_MAX_ROWS, TEAM_MAX_FILE_MB, TEAM_MAX_ROWS } from "@/lib/billing";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { safeAnalysisError } from "@/lib/analysis-state";

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

type Status = { isPro: boolean; plan: "free" | "pro" | "team"; periodEnd: string | null; analysesUsed: number; analysesThisMonth: number; freeLimit?: number };

const PAID = [
  { id: "pro" as const, name: "Pro", price: 19, highlight: true, features: ["Analyses illimitées", `Fichiers jusqu'à ${PRO_MAX_FILE_MB} Mo et ${PRO_MAX_ROWS.toLocaleString("fr-FR")} lignes`, "CSV, Excel, JSON, GeoJSON, LAS", "Historique illimité", "Exports PDF et Excel"] },
  { id: "team" as const, name: "Team", price: 49, highlight: false, features: ["Tout le plan Pro", `Fichiers jusqu'à ${TEAM_MAX_FILE_MB} Mo et ${TEAM_MAX_ROWS.toLocaleString("fr-FR")} lignes`, "Traitement prioritaire", "Support dédié par email"] },
];

function PricingPage() {
  const navigate = useNavigate();
  const billingStatus = useServerFn(getBillingStatus);
  const checkout = useServerFn(startCheckout);
  const portal = useServerFn(openPortal);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    setLoggedIn(!!data.session);
    if (data.session) {
      try {
        setStatus(await billingStatus());
      } catch (e) {
        console.error(e);
      }
    }
  }

  useEffect(() => {
    refresh();
    const p = new URLSearchParams(window.location.search);
    if (p.get("success")) toast.success("Paiement confirmé ! Bienvenue dans votre nouvelle offre.");
    if (p.get("canceled")) toast("Paiement annulé.");
  }, []);

  async function subscribe(plan: "pro" | "team") {
    if (!loggedIn) return navigate({ to: "/login" });
    setBusy(true);
    try {
      const { url } = await checkout({ data: { plan } });
      window.location.href = url;
    } catch (e) {
      toast.error(safeAnalysisError(e instanceof Error ? e.message : "Paiement indisponible."));
      setBusy(false);
    }
  }

  async function manage() {
    setBusy(true);
    try {
      const { url } = await portal();
      window.location.href = url;
    } catch (e) {
      toast.error(safeAnalysisError(e instanceof Error ? e.message : "Portail indisponible."));
      setBusy(false);
    }
  }

  const plan = status?.plan ?? "free";
  const isPro = plan !== "free";

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

      <main className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="text-center font-display text-4xl font-bold tracking-tight">Tarifs simples</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Essayez gratuitement, passez à l’offre qui vous convient. Sans engagement.
        </p>
        {status && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isPro
              ? `Offre ${plan === "team" ? "Team" : "Pro"} active · ${status.analysesThisMonth} analyses ce mois-ci`
              : `Essai : ${Math.min(status.analysesUsed, status.freeLimit ?? FREE_ANALYSIS_LIMIT)} / ${status.freeLimit ?? FREE_ANALYSIS_LIMIT} analyses utilisées`}
          </p>
        )}

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-8">
            <h2 className="font-display text-lg font-semibold">Essai gratuit</h2>
            <p className="mt-2 font-display text-4xl font-bold">0 €</p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {[`${FREE_ANALYSIS_LIMIT} analyses offertes`, `Fichiers jusqu'à ${FREE_MAX_FILE_MB} Mo et ${FREE_MAX_ROWS.toLocaleString("fr-FR")} lignes`, "Historique des conversations", "Pas d’export"].map((f) => (
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

          {PAID.map((p) => (
            <div key={p.id} className={`rounded-2xl bg-card p-8 ${p.highlight ? "border-2 border-primary shadow-sm" : "border border-border"}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{p.name}</h2>
                {plan === p.id ? (
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Votre offre</span>
                ) : p.highlight ? (
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Populaire</span>
                ) : null}
              </div>
              <p className="mt-2 font-display text-4xl font-bold">
                {p.price} €<span className="text-base font-normal text-muted-foreground">/mois</span>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary" />{f}</li>
                ))}
              </ul>
              {isPro ? (
                <Button variant="outline" onClick={manage} disabled={busy} className="mt-8 w-full">
                  {plan === p.id ? "Gérer mon abonnement" : "Changer d’offre"}
                </Button>
              ) : (
                <Button onClick={() => subscribe(p.id)} disabled={busy} variant={p.highlight ? "default" : "outline"} className="mt-8 w-full">
                  {busy ? "Redirection…" : `Choisir ${p.name}`}
                </Button>
              )}
              {plan === p.id && status?.periodEnd && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Renouvellement le {new Date(status.periodEnd).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 text-center"><Button asChild variant="link"><Link to="/pro">Découvrir tous les avantages Pro →</Link></Button></div>
        <p className="mt-8 text-center text-xs text-muted-foreground">Paiement sécurisé par Stripe. Annulation en un clic.</p>
      </main>
    </div>
  );
}
