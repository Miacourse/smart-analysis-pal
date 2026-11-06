import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ChatShell } from "@/components/chat/chat-shell";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useLang } from "@/lib/i18n";
import { readDashboardIds } from "@/lib/brand-state";

export const Route = createFileRoute("/dashboards")({
  head: () => ({
    meta: [
      { title: "Tableaux de bord — Datello" },
      { name: "description", content: "Vos analyses enregistrées dans Datello." },
      { property: "og:title", content: "Tableaux de bord — Datello" },
      { property: "og:description", content: "Retrouvez les analyses et graphiques ajoutés à vos tableaux de bord Datello." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardsPage,
});

type AnalysisThread = {
  id: string;
  title: string;
  dataset_name: string | null;
  updated_at: string;
};

function DashboardsPage() {
  const navigate = useNavigate();
  const { t, locale } = useLang();
  const [threads, setThreads] = useState<AnalysisThread[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      const { data } = await supabase
        .from("threads")
        .select("id, title, dataset_name, updated_at")
        .not("dataset_name", "is", null)
        .order("updated_at", { ascending: false });
      const savedIds = readDashboardIds(session.user.id);
      if (!cancelled) setThreads(((data ?? []) as AnalysisThread[]).filter((thread) => savedIds.includes(thread.id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <ChatShell>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-[860px]">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">
            {t("Tableaux de bord")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Reprenez vos analyses enregistrées et leurs graphiques.")}
          </p>

          {threads === null ? (
            <Shimmer className="mt-8 text-sm">{t("Chargement de vos tableaux de bord…")}</Shimmer>
          ) : threads.length === 0 ? (
            <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
              <BarChart3 className="h-8 w-8 text-brand-teal-dark" />
              <p className="mt-3 font-medium text-foreground">
                {t("Aucun tableau de bord pour le moment.")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {langText()}
              </p>
              <Link
                to="/chat"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand-teal-dark px-4 text-sm font-semibold text-white hover:bg-brand-teal"
              >
                {t("Nouvelle analyse")}
              </Link>
            </div>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: thread.id }}
                    className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm transition-colors hover:border-brand-teal hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-wash text-brand-teal-dark">
                      <BarChart3 className="h-5 w-5" />
                    </span>
                    <span className="line-clamp-2 font-medium text-foreground">{thread.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {thread.dataset_name}
                    </span>
                    <span className="mt-auto text-xs text-muted-foreground">
                      {new Date(thread.updated_at).toLocaleDateString(locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ChatShell>
  );
}
