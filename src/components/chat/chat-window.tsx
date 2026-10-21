import { getBillingStatus } from "@/lib/billing.functions";
import { canExport, maxFileMb, maxRows, type Plan } from "@/lib/billing";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { analysisFetch, safeAnalysisError, type AnalysisPhase } from "@/lib/analysis-state";
import { stripChartBlocks } from "@/lib/chart-spec";
import {
  ANALYSIS_DOMAINS,
  getAnalysisDomain,
  type AnalysisDomainId,
} from "@/lib/analysis-domains";
import {
  parseCsvFile,
  parseExcelFile,
  parseJsonFile,
  parseLasFile,
  profileDataset,
  profileSummary,
  type DatasetProfile,
} from "@/lib/dataset-profile";
import { AnalysisProgress, UploadProgress } from "./analysis-progress";
import { AnalysisCharts } from "./analysis-charts";
import { AnalysisOverview } from "./analysis-overview";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FileDown, FileSpreadsheet, Layers, Paperclip } from "lucide-react";
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

function parseStoredProfile(raw: unknown): DatasetProfile | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as DatasetProfile;
  } catch {
    return null;
  }
}

export function ChatWindow({ threadId }: { threadId: string }) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [datasetRows, setDatasetRows] = useState<number | null>(null);
  const [datasetProfile, setDatasetProfile] = useState<DatasetProfile | null>(null);
  const [datasetPreview, setDatasetPreview] = useState<string | null>(null);
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
        supabase
          .from("threads")
          .select("dataset_name, dataset_rows, dataset_profile, dataset_preview")
          .eq("id", threadId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setInitialMessages(rowsToUIMessages(msgs ?? []));
      setDatasetName(thread?.dataset_name ?? null);
      setDatasetRows(thread?.dataset_rows ?? null);
      setDatasetProfile(parseStoredProfile(thread?.dataset_profile));
      setDatasetPreview(thread?.dataset_preview ?? null);
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
      datasetProfile={datasetProfile}
      datasetPreview={datasetPreview}
      accessToken={accessToken}
      onDatasetChange={(name, rows, profile, preview) => {
        setDatasetName(name);
        setDatasetRows(rows);
        setDatasetProfile(profile);
        setDatasetPreview(preview);
      }}
    />
  );
}

function ChatSession({
  threadId,
  initialMessages,
  datasetName,
  datasetRows,
  datasetProfile,
  datasetPreview,
  accessToken,
  onDatasetChange,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  datasetName: string | null;
  datasetRows: number | null;
  datasetProfile: DatasetProfile | null;
  datasetPreview: string | null;
  accessToken: string | null;
  onDatasetChange: (
    name: string,
    rows: number | null,
    profile: DatasetProfile | null,
    preview: string | null,
  ) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const billingStatus = useServerFn(getBillingStatus);
  const [processing, setProcessing] = useState<{ phase: AnalysisPhase; startedAt: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [domain, setDomain] = useState<AnalysisDomainId>("general");
  const [domainOwner, setDomainOwner] = useState(threadId);

  useEffect(() => {
    let next: AnalysisDomainId = "general";
    try {
      const saved = localStorage.getItem(`dacopilot-domain:${threadId}`);
      if (saved) next = getAnalysisDomain(saved).id;
    } catch {
      // stockage local indisponible
    }
    setDomain(next);
    setDomainOwner(threadId);
  }, [threadId]);

  useEffect(() => {
    if (domainOwner !== threadId) return;
    try {
      localStorage.setItem(`dacopilot-domain:${threadId}`, domain);
    } catch {
      // stockage local indisponible
    }
  }, [threadId, domain, domainOwner]);

  const domainMeta = getAnalysisDomain(domain);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: analysisFetch,
        body: { threadId, domain },
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token ?? accessToken;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [threadId, accessToken, domain],
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
    onDatasetChange(file.name, profile.rows, profile, preview);
    toast.success(`Fichier « ${file.name} » chargé : ${profileSummary(profile)} analysées.`);
    textareaRef.current?.focus();
  }

  async function handleCsvUpload(file: File) {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const isJson = /\.(json|geojson)$/i.test(file.name);
    const isLas = /\.las$/i.test(file.name);
    let plan: Plan = "free";
    try {
      plan = (await billingStatus()).plan;
    } catch {
      plan = "free";
    }
    if (file.size > maxFileMb(plan) * 1024 * 1024) {
      toast.error(
        `Votre offre accepte les fichiers jusqu'à ${maxFileMb(plan)} Mo. Passez à l’offre supérieure pour les fichiers plus volumineux.`,
        {
          action: {
            label: "Voir les offres",
            onClick: () => {
              navigate({ to: "/pricing" });
            },
          },
        },
      );
      return;
    }
    setUploading(true);
    setUploadName(file.name);
    setUploadProgress(0);
    setAnalysisError(null);
    try {
      const rows = isExcel
        ? await parseExcelFile(file)
        : isJson
          ? await parseJsonFile(file)
          : isLas
            ? await parseLasFile(file)
            : await parseCsvFile(file, (ratio) => setUploadProgress(ratio));
      setUploadProgress(1);
      if (rows.length < 2) throw new Error("empty");
      const rowCount = rows.length - 1;
      if (rowCount > maxRows(plan)) {
        toast.error(
          `Votre offre accepte jusqu'à ${maxRows(plan).toLocaleString("fr-FR")} lignes ; ce fichier en contient ${rowCount.toLocaleString("fr-FR")}. Passez à l’offre supérieure pour les fichiers plus volumineux.`,
          {
            action: {
              label: "Voir les offres",
              onClick: () => {
                navigate({ to: "/pricing" });
              },
            },
          },
        );
        return;
      }
      const profile = profileDataset(rows, file.name);
      await saveDataset(file, rows, profile);
    } catch {
      toast.error(
        isExcel
          ? "Lecture du fichier Excel impossible. Vérifiez qu’il n’est pas protégé."
          : isJson
            ? "Lecture du fichier JSON/GeoJSON impossible. Vérifiez sa structure."
            : isLas
              ? "Lecture du fichier LAS impossible. Vérifiez les sections ~C et ~A."
              : "Lecture du fichier impossible. Utilisez un CSV valide.",
      );
    } finally {
      setUploading(false);
      setTimeout(() => {
        setUploadProgress(null);
        setUploadName(null);
      }, 700);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Select value={domain} onValueChange={(value) => setDomain(getAnalysisDomain(value).id)}>
            <SelectTrigger
              className="h-8 w-auto min-w-[150px] gap-2 border-border bg-card text-xs"
              title={domainMeta.description}
            >
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {ANALYSIS_DOMAINS.map((item) => (
                <SelectItem key={item.id} value={item.id} title={item.description}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <span>Aucun fichier associé — téléversez un fichier pour analyser vos données.</span>
            )}
          </div>
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
            {datasetName ? "Remplacer le fichier" : "Téléverser un fichier"}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.json,.geojson,application/json,application/geo+json,.las"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCsvUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      {uploading && <UploadProgress progress={uploadProgress ?? 0} fileName={uploadName} />}
      {!uploading && processing && <AnalysisProgress phase={processing.phase} startedAt={processing.startedAt} />}
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
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Layers className="h-3 w-3" />
                {domainMeta.label}
              </span>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{domainMeta.description}</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Téléversez un fichier (CSV, Excel, JSON, GeoJSON, LAS…), puis posez votre question métier.
              </p>
              <p className="mt-3 max-w-lg text-xs text-muted-foreground">
                Exemples : {domainMeta.examples.join(" · ")}
              </p>
              {datasetProfile && <AnalysisOverview profile={datasetProfile} />}
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "assistant" ? (
                      <MessageResponse key={i}>{/<(?:!doctype|html|head|body)\b/i.test(part.text) ? safeAnalysisError(part.text) : stripChartBlocks(part.text)}</MessageResponse>
                    ) : (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  return null;
                })}
                {m.role === "assistant" && !busy && (
                  <AnalysisCharts
                    text={m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n")}
                    preview={datasetPreview}
                  />
                )}
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
            DA-Copilot s'appuie sur le profil statistique complet du fichier et un échantillon
            d'illustration. Vérifiez les chiffres clés.
          </p>
        </div>
      </div>
    </div>
  );
}
