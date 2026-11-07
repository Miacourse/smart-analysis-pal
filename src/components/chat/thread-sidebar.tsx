import { Button } from "@/components/ui/button";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  FileText,
  LogOut,
  Mail,
  MessageCircle,
  Plus,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getBillingStatus, getIsAdmin } from "@/lib/billing.functions";
import { deleteAccount } from "@/lib/account.functions";
import { FREE_ANALYSIS_LIMIT } from "@/lib/billing";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { DatelloLogo } from "@/components/brand/DatelloLogo";
import { useLang } from "@/lib/i18n";

type Thread = {
  id: string;
  title: string;
  dataset_name: string | null;
  updated_at: string;
};

type Usage = {
  plan: "free" | "pro" | "team";
  analysesUsed: number;
  analysesThisMonth: number;
  periodEnd: string | null;
  freeLimit?: number;
};

function fileBadge(name: string) {
  return /\.(xlsx|xls)$/i.test(name) ? "XLS" : "CSV";
}

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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { t, locale, lang, setLang } = useLang();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const billingStatus = useServerFn(getBillingStatus);
  const adminCheck = useServerFn(getIsAdmin);
  const removeAccount = useServerFn(deleteAccount);

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
    billingStatus()
      .then(setUsage)
      .catch(() => {});
  }, [activeThreadId, billingStatus]);

  useEffect(() => {
    const reload = () => loadThreads();
    window.addEventListener("da-thread-updated", reload);
    return () => window.removeEventListener("da-thread-updated", reload);
  }, []);

  const [email, setEmail] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    adminCheck()
      .then((r: { isAdmin: boolean }) => setIsAdmin(r.isAdmin))
      .catch(() => {});
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [adminCheck]);

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
      toast.error(t("Impossible de créer la conversation."));
      return;
    }
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
    onNavigate?.();
  }

  async function deleteThread(id: string) {
    if (
      !confirm(t("Supprimer cette conversation et son historique ? Cette action est définitive."))
    )
      return;
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      toast.error(t("Suppression impossible."));
      return;
    }
    setThreads((prev) => prev.filter((item) => item.id !== id));
    if (id === activeThreadId) navigate({ to: "/chat" });
    onNavigate?.();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
    onNavigate?.();
  }

  async function confirmDeleteAccount() {
    if (deleteConfirmation !== "SUPPRIMER") return;
    setDeleting(true);
    try {
      await removeAccount({ data: { confirmation: deleteConfirmation } });
      await supabase.auth.signOut();
      toast.success(t("Votre compte a été supprimé."));
      navigate({ to: "/" });
      onNavigate?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Suppression impossible."));
    } finally {
      setDeleting(false);
    }
  }

  const conversationsActive = pathname === "/chat" || pathname.startsWith("/chat/");
  const filesActive = pathname.startsWith("/files");
  const dashboardsActive = pathname.startsWith("/dashboards");
  const recentFiles = threads.filter((thread) => thread.dataset_name).slice(0, 5);

  const navItem = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
      active
        ? "bg-sidebar-accent font-semibold text-sidebar-foreground"
        : "text-sidebar-foreground/75 hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground"
    }`;

  return (
    <aside
      className={`flex h-full w-[260px] shrink-0 flex-col bg-sidebar text-sidebar-foreground ${className ?? ""}`}
    >
      <div className="flex items-center px-4 py-5">
        <Link to="/" onClick={() => onNavigate?.()} aria-label="Datello">
          <DatelloLogo dark height={32} />
        </Link>
      </div>

      <div className="px-3">
        <Button variant="ghost"
          onClick={createThread}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-teal-dark px-3 py-2.5 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
        >
          <Plus className="h-4 w-4" />
          {t("Nouvelle analyse")}
        </Button>
      </div>

      <nav className="mt-4 space-y-1 px-3">
        <Link to="/chat" onClick={() => onNavigate?.()} className={navItem(conversationsActive)}>
          <MessageCircle className="h-4 w-4 shrink-0" />
          {t("Conversations")}
        </Link>
        <Link to="/files" onClick={() => onNavigate?.()} className={navItem(filesActive)}>
          <FileText className="h-4 w-4 shrink-0" />
          {t("Mes fichiers")}
        </Link>
        <Link to="/dashboards" onClick={() => onNavigate?.()} className={navItem(dashboardsActive)}>
          <BarChart3 className="h-4 w-4 shrink-0" />
          {t("Tableaux de bord")}
        </Link>
      </nav>

      <div className="mt-5 flex-1 overflow-y-auto px-3 pb-3">
        {recentFiles.length > 0 && (
          <div className="mb-4">
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
              {t("Fichiers récents")}
            </p>
            <ul className="space-y-0.5">
              {recentFiles.map((thread) => (
                <li key={`file-${thread.id}`}>
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: thread.id }}
                    onClick={() => onNavigate?.()}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-foreground/75 hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate" title={thread.dataset_name ?? ""}>
                      {thread.dataset_name}
                    </span>
                    <span className="shrink-0 rounded bg-sidebar-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-foreground/70">
                      {fileBadge(thread.dataset_name ?? "")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
          {t("Conversations")}
        </p>
        <div className="space-y-0.5">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
                thread.id === activeThreadId
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-foreground/5"
              }`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: thread.id }}
                onClick={() => onNavigate?.()}
                className="min-w-0 flex-1 truncate px-1 py-1"
              >
                <span className="block truncate font-medium">{thread.title}</span>
                {thread.dataset_name && (
                  <span
                    className="block truncate text-xs text-sidebar-foreground/45"
                    title={thread.dataset_name}
                  >
                    {thread.dataset_name}
                  </span>
                )}
              </Link>
              <Button variant="ghost"
                onClick={() => deleteThread(thread.id)}
                aria-label={t("Supprimer la conversation")}
                className="rounded p-1 opacity-0 transition-opacity hover:bg-sidebar-foreground/10 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-sidebar-foreground/60" />
              </Button>
            </div>
          ))}
          {threads.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-sidebar-foreground/45">
              {t("Aucune conversation. Lancez votre première analyse !")}
            </p>
          )}
        </div>
      </div>

      <div className="max-h-[55%] shrink-0 space-y-1 overflow-y-auto border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-1 rounded-lg bg-sidebar-foreground/5 p-1">
          {(["fr", "en"] as const).map((code) => (
            <Button variant="ghost"
              key={code}
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`min-h-8 flex-1 rounded-md px-2 text-xs font-semibold uppercase transition-colors ${
                lang === code
                  ? "bg-sidebar-foreground/15 text-sidebar-foreground"
                  : "text-sidebar-foreground/55 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
              }`}
            >
              {code === "fr" ? "Français" : "English"}
            </Button>
          ))}
        </div>

        {usage && (
          <div className="mb-2 rounded-lg bg-sidebar-foreground/5 px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sidebar-foreground">
                {usage.plan === "team" ? "Team" : usage.plan === "pro" ? "Pro" : t("Gratuit")}
              </span>
              {usage.plan !== "free" && (
                <span className="rounded-full bg-brand-teal-dark px-2 py-0.5 text-[10px] font-semibold text-sidebar-foreground">
                  {t("Actif")}
                </span>
              )}
            </div>
            <p className="mt-1 text-sidebar-foreground/55">
              {usage.plan === "free"
                ? t("{used} / {limit} analyses utilisées", {
                    used: Math.min(usage.analysesUsed, usage.freeLimit ?? FREE_ANALYSIS_LIMIT),
                    limit: usage.freeLimit ?? FREE_ANALYSIS_LIMIT,
                  })
                : t("Analyses illimitées")}
            </p>
            {usage.plan === "free" && (
              <div className="mt-1.5 h-1.5 rounded-full bg-sidebar-foreground/15">
                <div
                  className="h-full rounded-full bg-brand-mint"
                  style={{
                    width: `${Math.min(100, (usage.analysesUsed / (usage.freeLimit ?? FREE_ANALYSIS_LIMIT)) * 100)}%`,
                  }}
                />
              </div>
            )}
            {usage.plan === "free" &&
              usage.analysesUsed >= (usage.freeLimit ?? FREE_ANALYSIS_LIMIT) && (
                <Link
                  to="/pricing"
                  onClick={() => onNavigate?.()}
                  className="mt-2 flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-brand-teal-dark px-2 py-1.5 text-[11px] font-semibold text-sidebar-foreground hover:bg-brand-teal"
                >
                  <Sparkles className="h-3 w-3" />
                  {t("Passer à Pro — analyses illimitées")}
                </Link>
              )}
            {usage.plan !== "free" && usage.periodEnd && (
              <p className="text-sidebar-foreground/55">
                {t("Renouvellement le {date}", {
                  date: new Date(usage.periodEnd).toLocaleDateString(locale),
                })}
              </p>
            )}
          </div>
        )}
        {isAdmin && (
          <Link
            to="/admin"
            onClick={() => onNavigate?.()}
            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-foreground/5"
          >
            <Shield className="h-4 w-4" />
            {t("Administration")}
          </Link>
        )}
        <Link
          to="/pricing"
          onClick={() => onNavigate?.()}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand-mint hover:bg-sidebar-foreground/5"
        >
          <Sparkles className="h-4 w-4" />
          {t("Offres / Abonnement")}
        </Link>
        {email && (
          <p className="truncate px-3 pt-2 text-xs text-sidebar-foreground/45" title={email}>
            {t("Connecté :")} <span className="font-medium text-sidebar-foreground">{email}</span>
          </p>
        )}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/55 hover:bg-sidebar-foreground/5"
        >
          <Mail className="h-4 w-4" />
          {t("Aide / Contact")}
        </a>
        <Button variant="ghost"
          onClick={signOut}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/55 hover:bg-sidebar-foreground/5"
        >
          <LogOut className="h-4 w-4" />
          {t("Se déconnecter / changer de compte")}
        </Button>
        <Button variant="ghost"
          onClick={() => {
            setDeleteOpen((open) => !open);
            setDeleteConfirmation("");
          }}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
          {t("Supprimer mon compte")}
        </Button>
        {deleteOpen && (
          <div className="mx-3 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
            <p className="font-semibold text-destructive">{t("Cette action est définitive.")}</p>
            <p className="mt-1 text-sidebar-foreground/60">
              {t(
                "Votre abonnement Stripe actif sera résilié immédiatement. Tapez SUPPRIMER pour confirmer.",
              )}
            </p>
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className="mt-2 w-full rounded-md border border-sidebar-foreground/20 bg-sidebar-foreground/10 px-2 py-1.5 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40"
              placeholder="SUPPRIMER"
              aria-label={t("Confirmation de suppression du compte")}
            />
            <div className="mt-2 flex gap-2">
              <Button variant="ghost"
                onClick={confirmDeleteAccount}
                disabled={deleteConfirmation !== "SUPPRIMER" || deleting}
                className="rounded-md bg-destructive px-2.5 py-1.5 font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {deleting ? t("Suppression…") : t("Confirmer")}
              </Button>
              <Button variant="ghost"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmation("");
                }}
                className="rounded-md border border-sidebar-foreground/20 px-2.5 py-1.5 text-sidebar-foreground/80"
              >
                {t("Annuler")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
