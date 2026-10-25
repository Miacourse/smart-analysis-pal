import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Search, Users, MessagesSquare, Activity, Euro, Crown, AlertTriangle, Gift, MoreHorizontal, Plus, ShieldCheck, ShieldOff, Ban } from "lucide-react";

import { adminResetQuota, getAdminStats } from "@/lib/billing.functions";
import { adminAddBonus, adminSetComp, adminSetRole } from "@/lib/admin.functions";
import { FREE_ANALYSIS_LIMIT } from "@/lib/billing";
import { supabase } from "@/integrations/supabase/client";
import { GeoMap } from "@/components/chat/geo-map";
import { countryName, resolveCountry } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administration — DA-Copilot" },
      { name: "description", content: "Tableau de bord administrateur de DA-Copilot." },
      { property: "og:title", content: "Administration — DA-Copilot" },
      { property: "og:description", content: "Statistiques internes des utilisateurs, abonnements et analyses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Stats = Awaited<ReturnType<typeof getAdminStats>>;
const PLAN_LABEL = { free: "Gratuit", pro: "Pro", team: "Team" } as const;
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

function AdminPage() {
  const fetchStats = useServerFn(getAdminStats);
  const resetQuota = useServerFn(adminResetQuota);
  const setComp = useServerFn(adminSetComp);
  const addBonus = useServerFn(adminAddBonus);
  const setRole = useServerFn(adminSetRole);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "pro" | "team">("all");

  async function load() {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setError("Connectez-vous avec le compte administrateur.");
      setLoading(false);
      return;
    }
    try {
      setStats(await fetchStats());
      setError(null);
    } catch {
      setError("Accès réservé à l’administrateur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const users = useMemo(() => (stats?.users ?? []).filter((u) =>
    (planFilter === "all" || u.plan === planFilter) && u.email.toLowerCase().includes(query.toLowerCase()),
  ), [stats, query, planFilter]);

  async function reset(userId: string, email: string) {
    if (!confirm(`Remettre à zéro le compteur d’analyses de ${email} ?`)) return;
    try {
      await resetQuota({ data: { userId } });
      toast.success(`Compteur de ${email} remis à zéro.`);
      load();
    } catch {
      toast.error("Réinitialisation impossible.");
    }
  }

  async function setOffer(userId: string, email: string, plan: "pro" | "team" | "none") {
    const label = plan === "none" ? "retirer l’offre de" : `offrir ${PLAN_LABEL[plan]} à`;
    if (!confirm(`Voulez-vous ${label} ${email} ?`)) return;
    try {
      await setComp({ data: { userId, plan } });
      toast.success(plan === "none" ? `Offre retirée à ${email}.` : `${PLAN_LABEL[plan]} offert à ${email}.`);
      load();
    } catch {
      toast.error("Mise à jour de l’offre impossible.");
    }
  }

  async function grantBonus(userId: string, email: string, delta: number) {
    try {
      await addBonus({ data: { userId, delta } });
      toast.success(`${delta > 0 ? "+" : ""}${delta} analyses pour ${email}.`);
      load();
    } catch {
      toast.error("Mise à jour du quota impossible.");
    }
  }

  async function toggleAdmin(userId: string, email: string, isAdmin: boolean) {
    if (!confirm(isAdmin ? `Retirer les droits admin de ${email} ?` : `Donner les droits admin à ${email} ?`)) return;
    try {
      await setRole({ data: { userId, isAdmin } });
      toast.success(isAdmin ? `${email} n’est plus administrateur.` : `${email} est désormais administrateur.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    }
  }

  function exportCsv() {
    if (!stats) return;
    const head = "email;offre;analyses;analyses_30j;conversations;inscrit;derniere_connexion";
    const rows = stats.users.map((u) => [u.email, PLAN_LABEL[u.plan], u.analysesUsed, u.analyses30d, u.conversations, fmt(u.createdAt), fmt(u.lastSignIn)].join(";"));
    const blob = new Blob([[head, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "utilisateurs-da-copilot.csv";
    a.click();
  }

  const maxDay = Math.max(1, ...(stats?.perDay ?? []).map((d) => d.count));
  const maxVisitDay = Math.max(1, ...(stats?.visitsByDay ?? []).map((d) => d.count));
  const visitPoints = useMemo(
    () =>
      (stats?.visitsByCountry ?? []).flatMap((row): Array<{ label: string; lat: number; lng: number; value: number }> => {
        const country = resolveCountry(row.country);
        if (!country) return [];
        return [{ label: countryName(country.iso), lat: country.lat, lng: country.lng, value: row.count }];
      }),
    [stats],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Administration</h1>
            <p className="text-sm text-muted-foreground">Utilisateurs, abonnements et activité de DA-Copilot.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
            <Button asChild size="sm"><Link to="/chat">Retour à l’espace</Link></Button>
          </div>
        </div>

        {error && <p className="mt-8 rounded-lg border border-border bg-card p-6 text-muted-foreground">{error}</p>}
        {!stats && !error && <p className="mt-8 text-muted-foreground">Chargement…</p>}

        {stats && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon={Users} label="Utilisateurs" value={stats.totalUsers} />
              <Kpi icon={Crown} label="Abonnés Pro / Team" value={`${stats.proCount} / ${stats.teamCount}`} />
              <Kpi icon={Euro} label="Revenu mensuel estimé" value={`${stats.mrr} €`} />
              <Kpi icon={Activity} label="Analyses aujourd’hui" value={stats.analysesToday} />
              <Kpi icon={MessagesSquare} label="Conversations" value={stats.totalThreads} />
              <Kpi icon={Activity} label="Analyses au total" value={stats.totalAnalyses} />
              <Kpi icon={AlertTriangle} label="Gratuits proches de la limite" value={stats.nearLimit} />
              <Kpi icon={Activity} label="Analyses (14 jours)" value={stats.perDay.reduce((n, d) => n + d.count, 0)} />
            </div>

            <section className="mt-6 rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Analyses par jour (14 derniers jours)</h2>
              <div className="mt-4 flex h-32 items-end gap-1.5">
                {stats.perDay.map((d, i) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day} : ${d.count}`}>
                    <span className="text-[10px] text-muted-foreground">{d.count || ""}</span>
                    <div className="w-full rounded-t" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: 2, background: `var(--chart-${(i % 6) + 1})` }} />
                    <span className="text-[10px] text-muted-foreground">{d.day.slice(8)}</span>
                  </div>
                ))}
              </div>
            </section>

            <Tabs defaultValue="users" className="mt-6">
              <TabsList>
                <TabsTrigger value="users">Utilisateurs</TabsTrigger>
                <TabsTrigger value="trafic">Trafic</TabsTrigger>
                <TabsTrigger value="threads">Dernières analyses</TabsTrigger>
              </TabsList>

              <TabsContent value="users">
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un email…" className="pl-9" />
                  </div>
                  {(["all", "free", "pro", "team"] as const).map((p) => (
                    <Button key={p} size="sm" variant={planFilter === p ? "default" : "outline"} onClick={() => setPlanFilter(p)}>
                      {p === "all" ? "Tous" : PLAN_LABEL[p]}
                    </Button>
                  ))}
                  <Button size="sm" variant="outline" onClick={exportCsv}>Exporter CSV</Button>
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-border text-xs text-muted-foreground">
                      <tr><th className="p-3">Email</th><th className="p-3">Offre</th><th className="p-3">Analyses</th><th className="p-3">30 j</th><th className="p-3">Conv.</th><th className="p-3">Inscrit</th><th className="p-3">Connexion</th><th className="p-3" /></tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border last:border-0">
                          <td className="p-3 break-all">{u.email}{u.isAdmin && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">admin</span>}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.plan === "free" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>{PLAN_LABEL[u.plan]}</span>
                            {u.compPlan && <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">offert</span>}
                          </td>
                          <td className="p-3"><span className={u.plan === "free" && u.analysesUsed >= FREE_ANALYSIS_LIMIT + u.bonus ? "font-semibold text-destructive" : ""}>{u.analysesUsed}{u.plan === "free" ? ` / ${FREE_ANALYSIS_LIMIT + u.bonus}` : ""}</span></td>
                          <td className="p-3">{u.analyses30d}</td>
                          <td className="p-3">{u.conversations}</td>
                          <td className="p-3">{fmt(u.createdAt)}</td>
                          <td className="p-3">{fmt(u.lastSignIn)}</td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Offre</DropdownMenuLabel>
                                {u.plan !== "pro" && <DropdownMenuItem onClick={() => setOffer(u.id, u.email, "pro")}><Gift className="mr-2 h-4 w-4" />Offrir Pro</DropdownMenuItem>}
                                {u.plan !== "team" && <DropdownMenuItem onClick={() => setOffer(u.id, u.email, "team")}><Gift className="mr-2 h-4 w-4" />Offrir Team</DropdownMenuItem>}
                                {u.compPlan && <DropdownMenuItem onClick={() => setOffer(u.id, u.email, "none")}><Ban className="mr-2 h-4 w-4" />Retirer l’offre offerte</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Quota d’analyses</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => grantBonus(u.id, u.email, 5)}><Plus className="mr-2 h-4 w-4" />Ajouter 5 analyses</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => grantBonus(u.id, u.email, -5)} disabled={u.bonus === 0}><Ban className="mr-2 h-4 w-4" />Retirer 5 analyses</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => reset(u.id, u.email)}>Remettre à zéro</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Droits</DropdownMenuLabel>
                                {u.isAdmin
                                  ? <DropdownMenuItem onClick={() => toggleAdmin(u.id, u.email, false)}><ShieldOff className="mr-2 h-4 w-4" />Retirer admin</DropdownMenuItem>
                                  : <DropdownMenuItem onClick={() => toggleAdmin(u.id, u.email, true)}><ShieldCheck className="mr-2 h-4 w-4" />Rendre admin</DropdownMenuItem>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Aucun utilisateur.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="trafic">
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Kpi icon={Users} label="Visites (30 j)" value={stats.visitsTotal} />
                  <Kpi icon={Activity} label="Visites aujourd'hui" value={stats.visitsToday} />
                  <Kpi icon={Activity} label="Pays détectés" value={visitPoints.length} />
                </div>
                <div className="mt-3">
                  {visitPoints.length > 0 ? (
                    <GeoMap points={visitPoints} valueLabel="visites" height={360} />
                  ) : (
                    <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                      Aucune visite géolocalisée pour le moment. Les visites sont comptées sans cookie ni adresse IP,
                      à partir du pays fourni par le réseau.
                    </p>
                  )}
                </div>
                <div className="mt-3 rounded-xl border border-border bg-card p-5">
                  <h2 className="text-sm font-semibold">Visites par jour (14 derniers jours)</h2>
                  <div className="mt-4 flex h-28 items-end gap-1.5">
                    {stats.visitsByDay.map((d, i) => (
                      <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day} : ${d.count}`}>
                        <span className="text-[10px] text-muted-foreground">{d.count || ""}</span>
                        <div className="w-full rounded-t" style={{ height: `${(d.count / maxVisitDay) * 100}%`, minHeight: 2, background: `var(--chart-${(i % 6) + 1})` }} />
                        <span className="text-[10px] text-muted-foreground">{d.day.slice(8)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[360px] text-left text-sm">
                    <thead className="border-b border-border text-xs text-muted-foreground">
                      <tr><th className="p-3">Pays</th><th className="p-3">Visites</th></tr>
                    </thead>
                    <tbody>
                      {stats.visitsByCountry.map((row) => (
                        <tr key={row.country} className="border-b border-border last:border-0">
                          <td className="p-3">{row.country === "??" ? "Inconnu" : (countryName(resolveCountry(row.country)?.iso ?? "") || row.country)}</td>
                          <td className="p-3 tabular-nums">{row.count}</td>
                        </tr>
                      ))}
                      {stats.visitsByCountry.length === 0 && (
                        <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">Aucune visite.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Mesure d'audience sans cookie : seul le pays transmis par le réseau, la page et le référent sont
                  enregistrés. Aucune adresse IP ni donnée personnelle n'est stockée.
                </p>
              </TabsContent>

              <TabsContent value="threads">
                <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="border-b border-border text-xs text-muted-foreground">
                      <tr><th className="p-3">Utilisateur</th><th className="p-3">Conversation</th><th className="p-3">Fichier</th><th className="p-3">Mise à jour</th></tr>
                    </thead>
                    <tbody>
                      {stats.recentThreads.map((t) => (
                        <tr key={t.id} className="border-b border-border last:border-0">
                          <td className="p-3 break-all">{t.email}</td><td className="p-3">{t.title}</td><td className="p-3">{t.dataset ?? "—"}</td><td className="p-3">{fmt(t.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>

            <p className="mt-4 text-xs text-muted-foreground">Paiements, factures et remboursements : tableau de bord Stripe. Le revenu affiché est une estimation à partir des abonnements actifs.</p>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
