import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, FileSpreadsheet, MessageSquareText, ShieldCheck, TrendingUp, Upload } from "lucide-react";

import { FREE_ANALYSIS_LIMIT, FREE_MAX_FILE_MB, PRO_MAX_FILE_MB, PLAN_PRICES } from "@/lib/billing";
import { ANALYSIS_DOMAINS } from "@/lib/analysis-domains";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DA-Copilot — Agent d'analyse de données" },
      {
        name: "description",
        content:
          "Téléversez un fichier (CSV, Excel, JSON, GeoJSON, LAS…), posez votre question métier, et recevez une analyse claire, chiffrée et vérifiable : KPI, tendances, anomalies et recommandations.",
      },
      { property: "og:title", content: "DA-Copilot — Agent d'analyse de données" },
      {
        property: "og:description",
        content: "Vos données deviennent des décisions : analyses chiffrées et recommandations actionnables par IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: FileSpreadsheet, title: "Profilage", text: "Structure, qualité, valeurs manquantes et doublons passés au crible." },
  { icon: ShieldCheck, title: "Préparation", text: "Nettoyage documenté, avec un journal de transformations vérifiable." },
  { icon: BarChart3, title: "Exploration", text: "KPI, tendances, segments et anomalies mis en évidence." },
  { icon: TrendingUp, title: "Modélisation", text: "Approches prédictives simples quand elles apportent de la valeur." },
  { icon: MessageSquareText, title: "Recommandations", text: "Des conclusions chiffrées et des actions concrètes." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="DA-Copilot" width={36} height={36} className="h-9 w-9" />
          <span className="font-display text-lg font-semibold tracking-tight">DA-Copilot</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/pricing" className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Tarifs
          </Link>
          <Link to="/login" className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Se connecter
          </Link>
          <Link
            to="/chat"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Essayer gratuitement
          </Link>
        </nav>
      </header>

      <section className="bg-grid-paper">
        <div className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
          <p className="mx-auto mb-5 w-fit rounded-full border border-border bg-card px-4 py-1 text-xs font-medium text-muted-foreground">
            Agent d'analyse de données — 20 modes métier, EDA, ML, rapports
          </p>
          <h1 className="text-balance font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Vos données deviennent des <span className="text-primary">décisions</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Téléversez un fichier (CSV, Excel, JSON, GeoJSON, LAS…), posez votre question métier en
            langage naturel, et recevez une réponse claire, chiffrée et vérifiable : KPI, tendances,
            anomalies et recommandations actionnables.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              Analyser mes données
            </Link>
            <Link
              to="/pricing"
              className="rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight">
          Une méthode rigoureuse en 5 étapes
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Chaque analyse suit le même pipeline reproductible, du profilage brut jusqu'aux recommandations.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <s.icon className="h-5 w-5 text-secondary-foreground" />
              </div>
              <p className="mt-4 text-xs font-semibold text-muted-foreground">Étape {i + 1}</p>
              <h3 className="mt-1 font-display font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center font-display text-3xl font-bold tracking-tight">
            Pensé pour le monde des données
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Choisissez votre mode d'analyse : l'agent adapte les indicateurs, le vocabulaire et les
            visualisations à votre métier.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {ANALYSIS_DOMAINS.filter((domain) => domain.id !== "general").map((domain) => (
              <span
                key={domain.id}
                title={domain.description}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {domain.label}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
            Visualisations intégrées : Recharts, Vega-Lite et Plotly (coupes, cartes, 3D, ternaires,
            chandeliers, heatmaps).
          </p>
        </div>
      </section>

      <section id="tarifs" className="border-t border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="text-center font-display text-3xl font-bold tracking-tight">Tarifs simples</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-8">
              <h3 className="font-display text-lg font-semibold">Gratuit</h3>
              <p className="mt-2 font-display text-4xl font-bold">0 €</p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li>• {FREE_ANALYSIS_LIMIT} analyses offertes</li>
                <li>• Fichiers jusqu'à {FREE_MAX_FILE_MB} Mo (CSV, Excel, JSON, LAS…)</li>
                <li>• Historique des conversations</li>
              </ul>
              <Link
                to="/chat"
                className="mt-8 block rounded-lg border border-border bg-card px-4 py-2.5 text-center text-sm font-semibold hover:bg-muted"
              >
                Commencer
              </Link>
            </div>
            <div className="rounded-2xl border-2 border-primary bg-background p-8 shadow-sm">
              <h3 className="font-display text-lg font-semibold">Pro</h3>
              <p className="mt-2 font-display text-4xl font-bold">
                {PLAN_PRICES.pro.eur} €<span className="text-base font-normal text-muted-foreground">/mois</span>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li>• Analyses illimitées</li>
                <li>• Fichiers jusqu'à {PRO_MAX_FILE_MB} Mo (CSV, Excel, JSON, LAS…)</li>
                <li>• Historique illimité</li>
                <li>• Exports PDF et Excel</li>
              </ul>
              <Link
                to="/pricing"
                className="mt-8 block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Devenir Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" width={20} height={20} className="h-5 w-5" loading="lazy" />
            <span>DA-Copilot</span>
          </div>
          <p>Analyse de données rigoureuse et pédagogue.</p>
        </div>
      </footer>
    </div>
  );
}
