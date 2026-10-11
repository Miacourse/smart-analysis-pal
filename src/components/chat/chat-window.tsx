import { getBillingStatus } from "@/lib/billing.functions";
import { canExport, FREE_MAX_FILE_MB, PRO_MAX_FILE_MB } from "@/lib/billing";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { analysisFetch, safeAnalysisError, type AnalysisPhase } from "@/lib/analysis-state";
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
        supabase.from("threads").select("dataset_name").eq("id", threadId).maybeSingle(),
      ]);
      if (cancelled) return;
      setInitialMessages(rowsToUIMessages(msgs ?? []));
      setDatasetName(thread?.dataset_name ?? null);
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
      accessToken={accessToken}
      onDatasetChange={setDatasetName}
    />
  );
}

function ChatSession({
  threadId,
  initialMessages,
  datasetName,
  accessToken,
  onDatasetChange,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  datasetName: string | null;
  accessToken: string | null;
  onDatasetChange: (name: string) => void;
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

  async function handleCsvUpload(file: File) {
    if (file.size > PRO_MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${PRO_MAX_FILE_MB} Mo).`);
      return;
    }
    if (file.size > FREE_MAX_FILE_MB * 1024 * 1024) {
      let isPro = false;
      try {
        isPro = (await billingStatus()).isPro;
      } catch {}
      if (!isPro) {
        toast.error(`L'essai gratuit accepte les fichiers jusqu'à ${FREE_MAX_FILE_MB} Mo. Passez Pro pour aller jusqu'à ${PRO_MAX_FILE_MB} Mo.`, {
          action: { label: "Voir Pro", onClick: () => { navigate({ to: "/pro" }); } },
        });
        return;
      }
    }
    setUploading(true);
    setProcessing({ phase: "upload", startedAt: Date.now() });
    setAnalysisError(null);
    Papa.parse<string[]>(file, {
      worker: true,
      skipEmptyLines: "greedy",
      preview: MAX_PREVIEW_ROWS + 1,
      complete: async (results) => {
        setProcessing((p) => ({ phase: "parsing", startedAt: p?.startedAt ?? Date.now() }));
        if (results.errors.some((e) => e.type === "Quotes") || results.data.length < 2) {
          toast.error("Le CSV doit contenir un en-tête et au moins une ligne valide.");
          setUploading(false);
          setProcessing(null);
          return;
        }
        const preview = Papa.unparse(results.data);
        try {
        const { error } = await supabase
          .from("threads")
          .update({ dataset_name: file.name, dataset_preview: preview })
          .eq("id", threadId);
        if (error) {
          throw error;
        }
        onDatasetChange(file.name);
        toast.success(`Fichier « ${file.name} » chargé. Posez votre question !`);
        textareaRef.current?.focus();
        } catch {
          toast.error("Impossible d’associer le fichier à la conversation.");
        } finally {
          setUploading(false);
          setProcessing(null);
        }
      },
      error: () => {
        toast.error("Lecture du fichier impossible. Utilisez un CSV valide.");
        setUploading(false);
        setProcessing(null);
      },
    });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {datasetName ? (
            <>
              <Paperclip className="h-4 w-4" />
              <span className="break-all font-medium text-foreground">{datasetName}</span>
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
            {datasetName ? "Remplacer le fichier" : "Téléverser un CSV"}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCsvUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      {processing && <AnalysisProgress phase={processing.phase} startedAt={processing.startedAt} />}
      {analysisError && <div role="alert" className="border-b border-border px-4 py-3 text-sm text-destructive">{analysisError}</div>}

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
