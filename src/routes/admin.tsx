import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { getAdminStats } from "@/lib/billing.functions";
import { FREE_ANALYSIS_LIMIT } from "@/lib/billing";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administration — DA-Copilot" },
      { name: "description", content: "Tableau de bord administrateur de DA-Copilot." },
      { property: "og:title", content: "Administration — DA-Copilot" },
      { property: "og:description", content: "Statistiques internes des utilisateurs et analyses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Stats = Awaited<ReturnType<typeof getAdminStats>>;

function AdminPage() {
  const fetchStats = useServerFn(getAdminStats);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return setError("Connectez-vous avec le compte administrateur.");
      fetchStats().then(setStats).catch(() => setError("Accès réservé à l’administrateur."));
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">Administration</h1>
          <Link to="/chat" className="text-sm text-primary hover:underline">← Retour à l’espace</Link>
        </div>
        {error && <p className="mt-8 rounded-lg border border-border bg-card p-6 text-muted-foreground">{error}</p>}
        {!stats && !error && <p className="mt-8 text-muted-foreground">Chargement…</p>}
        {stats && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              {[["Utilisateurs", stats.totalUsers], ["Conversations", stats.totalThreads], ["Analyses (24 h)", stats.analysesToday], ["Analyses au total", stats.totalAnalyses]].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-border bg-card p-5">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="mt-1 font-display text-3xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr><th className="p-3">Email</th><th className="p-3">Inscrit le</th><th className="p-3">Dernière connexion</th><th className="p-3">Analyses</th></tr>
                </thead>
                <tbody>
                  {stats.users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="p-3 break-all">{u.email}</td>
                      <td className="p-3">{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                      <td className="p-3">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("fr-FR") : "—"}</td>
                      <td className="p-3">
                        <span className={u.analysesUsed >= FREE_ANALYSIS_LIMIT ? "font-semibold text-primary" : ""}>{u.analysesUsed}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Les paiements, factures et remboursements se gèrent dans votre tableau de bord Stripe.</p>
          </>
        )}
      </main>
    </div>
  );
}
