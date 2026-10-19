import { getBillingStatus } from "@/lib/billing.functions";
import { canExport, FREE_MAX_FILE_MB, PRO_MAX_FILE_MB, TEAM_MAX_FILE_MB, maxFileMb, type Plan } from "@/lib/billing";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { analysisFetch, safeAnalysisError, type AnalysisPhase } from "@/lib/analysis-state";
import {
  parseCsvFile,
  parseExcelFile,
  profileDataset,
  profileSummary,
  type DatasetProfile,
} from "@/lib/dataset-profile";
import { AnalysisProgress } from "./analysis-progress";
import { AnalysisCharts } from "./analysis-charts";
import { Button } from "@/components/ui/button";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FileDown, FileSpreadsheet, Paperclip } from "lucide-react";
import Papa from "papaparse";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import logo from "@/assets/logo.png";

const MAX_PREVIEW_ROWS = 40;

function rowsToUIMessages(rows: { id: string; role: string; parts: unknown }[]): UIMessage[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant",
    parts: (r.parts as UIMessage["parts"]) ?? [],
  }));
}

export function ChatWindow({ threadId }: { threadId: string }) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [datasetRows, setDatasetRows] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setAccessToken(session?.access_token ?? null);

      const [{ data: msgs }, { data: thread }] = await Promise.all([
        supabase.from("messages").select("id, role, parts").eq("thread_id", threadId).order("created_at"),
        supabase.from("threads").select("dataset_name, dataset_rows").eq("id", threadId).maybeSingle(),
      ]);
      if (cancelled) return;
      setInitialMessages(rowsToUIMessages(msgs ?? []));
      setDatasetName(thread?.dataset_name ?? null);
      setDatasetRows(thread?.dataset_rows ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  if (initialMessages === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Shimmer className="text-sm">Chargement de la conversation…</Shimmer>
      </div>
    );
  }

  return (
    <ChatSession
      threadId={threadId}
      initialMessages={initialMessages}
      datasetName={datasetName}
      datasetRows={datasetRows}
      accessToken={accessToken}
      onDatasetChange={(name, rows) => {
        setDatasetName(name);
        setDatasetRows(rows);
      }}
    />
  );
}

function ChatSession({
  threadId,
  initialMessages,
  datasetName,
  datasetRows,
  accessToken,
  onDatasetChange,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  datasetName: string | null;
  datasetRows: number | null;
  accessToken: string | null;
  onDatasetChange: (name: string, rows: number | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const billingStatus = useServerFn(getBillingStatus);
  const [processing, setProcessing] = useState<{ phase: AnalysisPhase; startedAt: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: analysisFetch,
        body: { threadId },
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token ?? accessToken;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [threadId, accessToken],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    transport,
    messages: initialMessages,
    onError: async (error) => {
      const msg = safeAnalysisError(error.message);
      setAnalysisError(msg);
      setProcessing(null);
      toast.error(msg);
    },
    onFinish: () => {
      setProcessing((p) => ({ phase: "charts", startedAt: p?.startedAt ?? Date.now() }));
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (status === "error") setProcessing(null);
    if (status === "ready" && processing?.phase === "charts") {
      const timer = setTimeout(() => setProcessing(null), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, processing?.phase]);

  async function handleExport(kind: "pdf" | "xlsx") {
    setExporting(true);
    try {
      const subscription = await billingStatus();
      if (!canExport(subscription.isPro)) {
        toast("Les exports PDF et Excel sont inclus dans Pro.");
        await navigate({ to: "/pro" });
        return;
      }
      const { data: thread } = await supabase
        .from("threads")
        .select("title, dataset_name, dataset_preview")
        .eq("id", threadId)
        .maybeSingle();
      const input = {
        title: thread?.title ?? "Analyse",
        datasetName: thread?.dataset_name ?? datasetName,
        datasetPreview: thread?.dataset_preview ?? null,
        messages,
      };
      const mod = await import("@/lib/export-report");
      if (kind === "pdf") await mod.exportPdf(input);
      else await mod.exportExcel(input);
      toast.success("Rapport exporté.");
    } catch (e) {
      console.error(e);
      toast.error("Export impossible. Réessayez.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  async function saveDataset(file: File, rows: string[][], profile: DatasetProfile) {
    setProcessing((p) => ({ phase: "parsing", startedAt: p?.startedAt ?? Date.now() }));
    if (rows.length < 2) {
      toast.error("Le fichier doit contenir un en-tête et au moins une ligne valide.");
      return;
    }
    const preview = Papa.unparse(rows.slice(0, MAX_PREVIEW_ROWS + 1));
    const { error } = await supabase
      .from("threads")
      .update({
        dataset_name: file.name,
        dataset_preview: preview,
        dataset_profile: JSON.stringify(profile),
        dataset_rows: profile.rows,
      })
      .eq("id", threadId);
    if (error) throw error;
    onDatasetChange(file.name, profile.rows);
    toast.success(`Fichier « ${file.name} » chargé : ${profileSummary(profile)} analysées.`);
    textareaRef.current?.focus();
  }

  async function handleCsvUpload(file: File) {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (file.size > TEAM_MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${TEAM_MAX_FILE_MB} Mo).`);
      return;
    }
    if (file.size > FREE_MAX_FILE_MB * 1024 * 1024) {
      let plan: Plan = "free";
      try {
        plan = (await billingStatus()).plan;
      } catch {}
      if (file.size > maxFileMb(plan) * 1024 * 1024) {
        toast.error(`Votre offre accepte les fichiers jusqu'à ${maxFileMb(plan)} Mo. Passez à l’offre supérieure (Pro ${PRO_MAX_FILE_MB} Mo, Team ${TEAM_MAX_FILE_MB} Mo).`, {
          action: { label: "Voir les offres", onClick: () => { navigate({ to: "/pricing" }); } },
        });
        return;
      }
    }
    setUploading(true);
    setProcessing({ phase: "upload", startedAt: Date.now() });
    setAnalysisError(null);
    const done = () => { setUploading(false); setProcessing(null); };
    try {
      setProcessing({ phase: "parsing", startedAt: Date.now() });
      const rows = isExcel ? await parseExcelFile(file) : await parseCsvFile(file);
      if (rows.length < 2) throw new Error("empty");
      const profile = profileDataset(rows, file.name);
      await saveDataset(file, rows, profile);
    } catch {
      toast.error(
        isExcel
          ? "Lecture du fichier Excel impossible. Vérifiez qu’il n’est pas protégé."
          : "Lecture du fichier impossible. Utilisez un CSV valide.",
      );
    } finally {
      done();
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {datasetName ? (
            <>
              <Paperclip className="h-4 w-4" />
              <span className="break-all font-medium text-foreground">{datasetName}</span>
              {datasetRows !== null && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {datasetRows.toLocaleString("fr-FR")} lignes analysées
                </span>
              )}
            </>
          ) : (
            <span>Aucun fichier associé — téléversez un CSV pour analyser vos données.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" title="Exporter le rapport PDF — Pro"
            disabled={busy || exporting || !messages.some((m) => m.role === "assistant")}
            onClick={() => handleExport("pdf")}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button variant="outline" size="sm" title="Exporter le rapport Excel — Pro"
            disabled={busy || exporting || !messages.some((m) => m.role === "assistant")}
            onClick={() => handleExport("xlsx")}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </Button>
          <Button variant="outline" size="sm" disabled={busy || uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {datasetName ? "Remplacer le fichier" : "Téléverser CSV / Excel"}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCsvUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      {processing && <AnalysisProgress phase={processing.phase} startedAt={processing.startedAt} />}
      {analysisError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-destructive"
        >
          <span>{analysisError}</span>
          {/analyses gratuites/i.test(analysisError) && (
            <Button size="sm" onClick={() => navigate({ to: "/pricing" })} className="shrink-0">
              Passer à Pro
            </Button>
          )}
        </div>
      )}

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <img src={logo} alt="DA-Copilot" width={56} height={56} className="h-14 w-14" />
              <h2 className="mt-4 font-display text-xl font-semibold">Que voulez-vous analyser ?</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Téléversez un fichier CSV, puis posez votre question métier : « Quels sont mes meilleurs
                produits ? », « Y a-t-il des anomalies dans mes ventes ? »…
              </p>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "assistant" ? (
                      <MessageResponse key={i}>{/<(?:!doctype|html|head|body)\b/i.test(part.text) ? safeAnalysisError(part.text) : part.text}</MessageResponse>
                    ) : (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  return null;
                })}
                {m.role === "assistant" && !busy && <AnalysisCharts text={m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n")} />}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && <Shimmer className="text-sm">Analyse en cours…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background px-4 py-4">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={(message) => {
              if (!message.text.trim() || busy || uploading) return;
              setAnalysisError(null);
              setProcessing({ phase: "ai", startedAt: Date.now() });
              sendMessage({ text: message.text });
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="Posez votre question sur vos données…"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={uploading} onStop={() => { stop(); setProcessing(null); }} />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            DA-Copilot base ses réponses sur l'extrait de données fourni. Vérifiez les chiffres clés.
          </p>
        </div>
      </div>
    </div>
  );
}
