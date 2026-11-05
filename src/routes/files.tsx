import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ChatShell } from "@/components/chat/chat-shell";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "Mes fichiers — Datello" },
      { name: "description", content: "Vos fichiers importés dans Datello." },
      { property: "og:title", content: "Mes fichiers — Datello" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FilesPage,
});

type FileThread = {
  id: string;
  title: string;
  dataset_name: string | null;
  dataset_rows: number | null;
  updated_at: string;
};

function FilesPage() {
  const navigate = useNavigate();
  const { t, locale } = useLang();
  const [threads, setThreads] = useState<FileThread[] | null>(null);

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
        .select("id, title, dataset_name, dataset_rows, updated_at")
        .not("dataset_name", "is", null)
        .order("updated_at", { ascending: false });
      if (!cancelled) setThreads((data ?? []) as FileThread[]);
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
            {t("Mes fichiers")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Retrouvez les fichiers importés et reprenez une analyse.")}
          </p>

          {threads === null ? (
            <Shimmer className="mt-8 text-sm">{t("Chargement de vos fichiers…")}</Shimmer>
          ) : threads.length === 0 ? (
            <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
              <Upload className="h-8 w-8 text-brand-teal-dark" />
              <p className="mt-3 font-medium text-foreground">
                {t("Aucun fichier pour le moment.")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Ouvrez une conversation puis importez un fichier CSV ou Excel.")}
              </p>
              <Link
                to="/chat"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand-teal-dark px-4 text-sm font-semibold text-white hover:bg-brand-teal"
              >
                {t("Nouvelle analyse")}
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-2">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: thread.id }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:border-brand-teal hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-wash text-brand-teal-dark">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {thread.dataset_name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {thread.title}
                        {thread.dataset_rows !== null
                          ? ` · ${t("{count} lignes analysées", { count: thread.dataset_rows.toLocaleString(locale) })}`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
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
