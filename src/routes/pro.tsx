import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Check, FileSpreadsheet, Globe2, LockKeyhole, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { startCheckout } from "@/lib/billing.functions";
import { safeAnalysisError } from "@/lib/analysis-state";
import {
  FREE_ANALYSIS_LIMIT,
  FREE_MAX_FILE_MB,
  FREE_MAX_ROWS,
  PRO_MAX_FILE_MB,
  PRO_MAX_ROWS,
} from "@/lib/billing";
import logo from "@/assets/logo.png";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "DA-Copilot Pro — Analyses illimitées à 19 €/mois" },
      {
        name: "description",
        content:
          "Passez en Pro : analyses illimitées, CSV jusqu’à 100 Mo, rapports PDF et Excel. Découvrez les exemples et les réponses à vos questions.",
      },
      { property: "og:title", content: "DA-Copilot Pro — Votre analyse, sans limites" },
      {
        property: "og:description",
        content:
          "19 €/mois, sans engagement. Analysez vos CSV et partagez vos rapports PDF et Excel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProPage,
});

const testimonials = [
  {
    name: "Julien",
    role: "E-commerçant, France",
    quote: "DA-Copilot m'a fait économiser 10h d'analyse sur mes ventes.",
  },
  { name: "Sarah", role: "Marketing, UK", quote: "Enfin un outil qui explique mes CSV sans code." },
  {
    name: "Carlos",
    role: "Consultant, Espagne",
    quote: "L'export Excel est parfait pour mes rapports.",
  },
];
const examples = [
  {
    file: "titanic_train.csv",
    title: "Comprendre la survie",
    before: "Des lignes de passagers, des âges manquants et plusieurs classes.",
    after: "Comparaison des groupes, contrôle des valeurs manquantes et limites de l’échantillon.",
    bars: [35, 70, 52],
    labels: ["Groupe A", "Groupe B", "Groupe C"],
  },
  {
    file: "ventes.csv",
    title: "Trouver les produits moteurs",
    before: "Des commandes dispersées entre produits, dates et montants.",
    after: "Classement des ventes, évolution des revenus et recommandations commerciales.",
    bars: [80, 56, 30],
    labels: ["Produit A", "Produit B", "Produit C"],
  },
  {
    file: "campagnes.csv",
    title: "Comparer les campagnes",
    before: "Des clics, des dépenses et des conversions difficiles à comparer.",
    after: "Lecture des indicateurs par canal et identification des écarts à approfondir.",
    bars: [42, 65, 88],
    labels: ["Canal A", "Canal B", "Canal C"],
  },
];
const faq = [
  [
    "Puis-je annuler à tout moment ?",
    "Oui. Depuis la page Tarifs, cliquez sur « Gérer mon abonnement » pour ouvrir le portail Stripe et annuler votre renouvellement, où que vous soyez.",
  ],
  [
    "Mon CSV est-il sécurisé ?",
    "Vos conversations sont liées à votre compte et leur accès est protégé. Le fichier original n’est pas conservé : un extrait CSV est enregistré avec votre conversation. Il n’est pas supprimé automatiquement après l’analyse ; vous pouvez supprimer la conversation. Évitez les données personnelles ou sensibles.",
  ],
  [
    "Ça marche pour les gros fichiers ?",
    "L’essai gratuit accepte jusqu’à 5 Mo et 50 000 lignes ; Pro jusqu’à 100 Mo et 500 000 lignes ; Team jusqu’à 250 Mo et 2 000 000 de lignes. Le profil statistique est calculé sur l’intégralité du fichier, avec un échantillonnage régulier au-delà de 200 000 lignes.",
  ],
  [
    "Puis-je payer depuis l’étranger ?",
    "Le paiement est traité par Stripe. Les cartes et moyens de paiement proposés dépendent du pays, de votre appareil et de la configuration du compte Stripe. Les options disponibles apparaissent avant de payer.",
  ],
  [
    "Puis-je obtenir un remboursement ?",
    "Annuler empêche les prochains renouvellements. Cela ne déclenche pas automatiquement un remboursement ; toute demande dépend des conditions applicables et des droits légaux de votre pays.",
  ],
  [
    "L’essai gratuit est-il toujours inclus ?",
    "Oui, vous pouvez commencer avec 5 analyses gratuites sans carte bancaire. Pro est un abonnement à 19 €/mois dès la souscription ; le paiement affiche le montant avant confirmation. Les exports PDF et Excel sont inclus dans Pro.",
  ],
];

function ProPage() {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const checkout = useServerFn(startCheckout);
  async function subscribe() {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await navigate({ to: "/login" });
        return;
      }
      const { url } = await checkout({ data: { plan: "pro" } });
      window.location.assign(url);
    } catch (error) {
      toast.error(
        safeAnalysisError(error instanceof Error ? error.message : "Paiement indisponible."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="" className="size-9" />
          <span className="font-display text-lg font-semibold">DA-Copilot</span>
        </Link>
        <nav className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to="/pricing">Tarifs</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/chat">Mon espace</Link>
          </Button>
        </nav>
      </header>
      <main>
        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
            <div className="flex items-center gap-3 text-sm font-medium text-primary">
              <img src={logo} alt="" className="size-12" /> DA-Copilot Pro
            </div>
            <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl">
              Passez en Pro <span className="text-primary">— 19 €/mois</span>
            </h1>
            <p className="mt-4 text-lg font-medium">Annulable partout dans le monde.</p>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Des questions aux décisions. Multipliez vos analyses, comparez vos résultats et
              partagez des rapports prêts pour votre équipe.
            </p>
            <Button
              size="lg"
              onClick={subscribe}
              disabled={busy}
              className="mt-8 h-auto whitespace-normal px-6 py-3"
            >
              {busy ? "Redirection…" : "Devenir Pro — Essai toujours inclus"}
              <ArrowRight className="shrink-0" />
            </Button>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Check className="size-4 text-primary" />
                Sans engagement
              </span>
              <span className="flex items-center gap-2">
                <LockKeyhole className="size-4" />
                Paiement sécurisé Stripe
              </span>
              <span className="flex items-center gap-2">
                <Globe2 className="size-4" />
                Annulation en ligne
              </span>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-5 py-14">
          <p className="text-xs font-semibold uppercase text-primary">Votre prochain niveau</p>
          <h2 className="mt-3 font-display text-3xl font-bold">
            Gratuit pour essayer. Pro pour avancer.
          </h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[340px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-4">Inclus</th>
                  <th className="px-3 py-4">Gratuit</th>
                  <th className="bg-secondary px-3 py-4 text-primary">Pro · 19 €/mois</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Analyses", `${FREE_ANALYSIS_LIMIT} offertes`, "Illimitées"],
                  ["Taille du fichier", `${FREE_MAX_FILE_MB} Mo`, `${PRO_MAX_FILE_MB} Mo`],
                  [
                    "Lignes par fichier",
                    FREE_MAX_ROWS.toLocaleString("fr-FR"),
                    PRO_MAX_ROWS.toLocaleString("fr-FR"),
                  ],
                  ["Formats", "CSV, Excel, JSON, LAS", "CSV, Excel, JSON, GeoJSON, LAS"],
                  ["Rapports", "Pas d’export", "PDF & Excel"],
                  ["Historique", "Oui", "Oui"],
                ].map(([label, free, pro]) => (
                  <tr key={label} className="border-b border-border">
                    <th className="py-5 font-medium">{label}</th>
                    <td className="px-3 text-muted-foreground">{free}</td>
                    <td className="bg-secondary/50 px-3 font-semibold text-primary">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            DA-Copilot profile l’intégralité de votre fichier (échantillonnage régulier au-delà de
            200 000 lignes) et détecte les vides, doublons, valeurs non numériques et valeurs
            aberrantes. L’offre Pro augmente les limites et débloque les exports. Besoin de fichiers
            plus volumineux ?{" "}
            <Link to="/pricing" className="font-semibold text-primary hover:underline">
              L’offre Team (49 €/mois)
            </Link>{" "}
            monte à 250 Mo et 2 000 000 de lignes.
          </p>
        </section>
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="font-display text-3xl font-bold">Du CSV brut à une lecture claire.</h2>
            <p className="mt-3 text-muted-foreground">
              Trois exemples illustratifs. Les graphiques ci-dessous ne sont pas des résultats
              calculés sur vos fichiers.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {examples.map((e) => (
                <article key={e.file} className="rounded-lg border border-border bg-background p-6">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <FileSpreadsheet className="size-4" />
                    {e.file}
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold">{e.title}</h3>
                  <p className="mt-4 text-xs font-bold text-muted-foreground">AVANT</p>
                  <p className="mt-2 text-sm text-muted-foreground">{e.before}</p>
                  <div className="mt-6 border-t border-border pt-5">
                    <p className="text-xs font-bold text-primary">APRÈS</p>
                    <div className="mt-4 space-y-3">
                      {e.bars.map((value, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[65px_1fr] items-center gap-2 text-xs"
                        >
                          <span>{e.labels[i]}</span>
                          <div className="h-4 bg-muted">
                            <div className="h-full bg-primary" style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-5 text-sm">{e.after}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="font-display text-3xl font-bold">Leurs mots, votre prochain déclic.</h2>
          <p className="mt-3 text-sm text-muted-foreground">Témoignages fournis par DA-Copilot.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.name} className="rounded-lg border border-border bg-card p-6">
                <div className="flex gap-1 text-primary" aria-label="5 étoiles sur 5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-5 text-lg font-medium">« {t.quote} »</blockquote>
                <figcaption className="mt-6 text-sm">
                  <strong>{t.name}</strong>
                  <span className="mt-1 block text-muted-foreground">{t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
        <section className="border-t border-border">
          <div className="mx-auto max-w-3xl px-5 py-14">
            <h2 className="font-display text-3xl font-bold">Vos questions, sans détour.</h2>
            <div className="mt-8">
              {faq.map(([q, a]) => (
                <details key={q} className="group border-b border-border py-5">
                  <summary className="cursor-pointer text-base font-semibold">{q}</summary>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="border-y border-border bg-secondary">
          <div className="mx-auto max-w-4xl px-5 py-14 text-center">
            <h2 className="font-display text-3xl font-bold">DA-Copilot Pro. À vous de décider.</h2>
            <p className="mt-4 text-muted-foreground">
              19 €/mois. Analyses illimitées. Rapports PDF et Excel.
            </p>
            <Button
              size="lg"
              disabled={busy}
              onClick={subscribe}
              className="mt-7 h-auto max-w-full whitespace-normal px-6 py-4"
            >
              {busy ? "Redirection…" : "Devenir Pro — Essai toujours inclus"}
              <ArrowRight />
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              L’essai gratuit de 5 analyses reste disponible avant de souscrire.
            </p>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-5 py-7 text-sm text-muted-foreground">
        <span>DA-Copilot · Vos données, vos décisions.</span>
        <div className="flex items-center gap-5">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary">
            Contact
          </a>
          <Link to="/pricing" className="hover:text-primary">
            Retour aux tarifs
          </Link>
        </div>
      </footer>
    </div>
  );
}
