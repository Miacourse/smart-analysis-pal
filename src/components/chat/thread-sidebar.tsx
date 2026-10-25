import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquarePlus, Trash2, LogOut, Sparkles, Shield } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getBillingStatus, getIsAdmin } from "@/lib/billing.functions";
import { FREE_ANALYSIS_LIMIT } from "@/lib/billing";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

type Thread = {
  id: string;
  title: string;
  dataset_name: string | null;
  updated_at: string;
};

type Usage = { plan: "free" | "pro" | "team"; analysesUsed: number; analysesThisMonth: number; periodEnd: string | null; freeLimit?: number };

export function ThreadSidebar({
  activeThreadId,
  className,
  onNavigate,
}: {
  activeThreadId?: string | undefined;
  className?: string | undefined;
  onNavigate?: (() => void) | undefined;
}) {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const billingStatus = useServerFn(getBillingStatus);
  const adminCheck = useServerFn(getIsAdmin);

  async function loadThreads() {
    const { data, error } = await supabase
      .from("threads")
      .select("id, title, dataset_name, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setThreads(data ?? []);
  }

  useEffect(() => {
    loadThreads();
    billingStatus().then(setUsage).catch(() => {});
  }, [activeThreadId]);

  useEffect(() => {
    const reload = () => loadThreads();
    window.addEventListener("da-thread-updated", reload);
    return () => window.removeEventListener("da-thread-updated", reload);
  }, []);

  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    adminCheck().then((r: { isAdmin: boolean }) => setIsAdmin(r.isAdmin)).catch(() => {});
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function createThread() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    const { data, error } = await supabase
      .from("threads")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Impossible de créer la conversation.");
      return;
    }
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
    onNavigate?.();
  }

  async function deleteThread(id: string) {
    if (!confirm("Supprimer cette conversation et son historique ? Cette action est définitive.")) return;
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible.");
      return;
    }
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (id === activeThreadId) navigate({ to: "/chat" });
    onNavigate?.();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
    onNavigate?.();
  }

  return (
    <aside
      className={`flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <img src={logo} alt="DA-Copilot" width={28} height={28} className="h-7 w-7" />
        <span className="font-display font-semibold text-sidebar-foreground">DA-Copilot</span>
      </div>

      <div className="p-3">
        <button
          onClick={createThread}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nouvelle analyse
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {threads.map((t) => (
          <div
            key={t.id}
            className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
              t.id === activeThreadId
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            }`}
          >
            <Link
              to="/chat/$threadId"
              params={{ threadId: t.id }}
              onClick={() => onNavigate?.()}
              className="min-w-0 flex-1 truncate px-1 py-1"
            >
              <span className="block truncate font-medium">{t.title}</span>
              {t.dataset_name && (
                <span className="block truncate text-xs text-muted-foreground">{t.dataset_name}</span>
              )}
            </Link>
            <button
              onClick={() => deleteThread(t.id)}
              aria-label="Supprimer la conversation"
              className="rounded p-1 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
        {threads.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Aucune conversation. Lancez votre première analyse !
          </p>
        )}
      </div>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        {usage && (
          <div className="mb-2 rounded-lg bg-sidebar-accent/60 px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sidebar-foreground">
                {usage.plan === "team" ? "Team" : usage.plan === "pro" ? "Pro" : "Essai gratuit"}
              </span>
              {usage.plan !== "free" && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Actif</span>}
            </div>
            <p className="mt-1 text-muted-foreground">
              {usage.plan === "free"
                ? `${Math.min(usage.analysesUsed, usage.freeLimit ?? FREE_ANALYSIS_LIMIT)} / ${usage.freeLimit ?? FREE_ANALYSIS_LIMIT} analyses utilisées`
                : `${usage.analysesThisMonth} analyses ce mois-ci`}
            </p>
            {usage.plan === "free" && (
              <div className="mt-1.5 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, usage.analysesUsed / (usage.freeLimit ?? FREE_ANALYSIS_LIMIT) * 100)}%` }} /></div>
            )}
            {usage.plan === "free" && usage.analysesUsed >= (usage.freeLimit ?? FREE_ANALYSIS_LIMIT) && (
              <Link
                to="/pricing"
                onClick={() => onNavigate?.()}
                className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="h-3 w-3" />
                Passer à Pro — analyses illimitées
              </Link>
            )}
            {usage.plan !== "free" && usage.periodEnd && (
              <p className="text-muted-foreground">Renouvellement le {new Date(usage.periodEnd).toLocaleDateString("fr-FR")}</p>
            )}
          </div>
        )}
        {isAdmin && (
          <Link to="/admin" onClick={() => onNavigate?.()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent">
            <Shield className="h-4 w-4" />
            Administration
          </Link>
        )}
        <Link
          to="/pricing"
          onClick={() => onNavigate?.()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-sidebar-accent"
        >
          <Sparkles className="h-4 w-4" />
          Offres / Abonnement
        </Link>
        {email && (
          <p className="truncate px-3 pt-2 text-xs text-muted-foreground" title={email}>
            Connecté : <span className="font-medium text-sidebar-foreground">{email}</span>
          </p>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter / changer de compte
        </button>
      </div>
    </aside>
  );
}
