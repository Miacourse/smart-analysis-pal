import { getBillingStatus } from "@/lib/billing.functions";
import { canExport, maxFileMb, maxRows, type Plan } from "@/lib/billing";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { analysisFetch, safeAnalysisError, type AnalysisPhase } from "@/lib/analysis-state";
import { stripChartBlocks } from "@/lib/chart-spec";
import { ANALYSIS_DOMAINS, getAnalysisDomain, type AnalysisDomainId } from "@/lib/analysis-domains";
import {
  normalizeDatasetRows,
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
import { useLang } from "@/lib/i18n";
import { domainLabel, domainDescription } from "@/lib/domain-i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Check, FileDown, FileSpreadsheet, Layers, Paperclip, RotateCcw } from "lucide-react";
import Papa from "papaparse";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { DatelloMascot } from "@/components/brand/DatelloMascot";
import { moments } from "@/lib/messages";
import { clarificationColumns, emptyReferencedColumn, saveDashboardId } from "@/lib/brand-state";

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
  const { t } = useLang();
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
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
        supabase
          .from("messages")
          .select("id, role, parts")
          .eq("thread_id", threadId)
          .order("created_at"),
        supabase
          .from("threads")
          .select("title, dataset_name, dataset_rows, dataset_profile, dataset_preview")
          .eq("id", threadId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setInitialMessages(rowsToUIMessages(msgs ?? []));
      setTitle(thread?.title ?? null);
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
        <Shimmer className="text-sm">{t("Chargement de la conversation…")}</Shimmer>
      </div>
    );
  }

  return (
    <ChatSession
      threadId={threadId}
      title={title}
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
  title,
  initialMessages,
  datasetName,
  datasetRows,
  datasetProfile,
  datasetPreview,
  accessToken,
  onDatasetChange,
}: {
  threadId: string;
  title: string | null;
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
  const { t, locale, lang } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const billingStatus = useServerFn(getBillingStatus);
  const [processing, setProcessing] = useState<{ phase: AnalysisPhase; startedAt: number } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [domain, setDomain] = useState<AnalysisDomainId>("general");
  const [domainOwner, setDomainOwner] = useState(threadId);
  const [draft, setDraft] = useState("");
  const [fileReady, setFileReady] = useState<{ lignes: number; colonnes: number } | null>(null);
  const [fileError, setFileError] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [online, setOnline] = useState(true);
  const [submittedQuestion, setSubmittedQuestion] = useState("");

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

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
      window.dispatchEvent(new Event("da-thread-updated"));
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
        toast(t("Les exports PDF et Excel sont inclus dans Pro."));
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
      if (kind === "pdf") {
        const { captureChartImages } = await import("@/lib/chart-capture");
        const charts = await captureChartImages();
        await mod.exportPdf({ ...input, charts });
      } else {
        await mod.exportExcel(input);
      }
      toast.success(t("Rapport exporté."));
    } catch (e) {
      console.error(e);
      toast.error(t("Export impossible. Réessayez."));
    } finally {
      setExporting(false);
    }
  }

  async function exportResponseChart(messageId: string) {
    setExporting(true);
    try {
      if (!canExport((await billingStatus()).isPro)) {
        toast(t("Les exports PDF et Excel sont inclus dans Pro."));
        await navigate({ to: "/pro" });
        return;
      }
      const root = document.getElementById(`datello-response-${messageId}`);
      if (!root) return;
      const { captureChartImages } = await import("@/lib/chart-capture");
      const charts = await captureChartImages(root);
      if (charts.length === 0) {
        toast(lang === "fr" ? "Aucun graphique à exporter dans cette réponse." : "No chart to export in this response.");
        return;
      }
      for (const [index, chart] of charts.entries()) {
        const link = document.createElement("a");
        link.href = chart.dataUrl;
        link.download = `datello-graphique-${index + 1}.png`;
        link.click();
      }
    } catch {
      toast.error(t("Export impossible. Réessayez."));
    } finally { setExporting(false); }
  }

  async function addToDashboard() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    try {
      saveDashboardId(data.user.id, threadId);
      toast.success(lang === "fr" ? "Analyse ajoutée aux favoris de ce navigateur." : "Analysis saved to this browser's favorites.");
      await navigate({ to: "/dashboards" });
    } catch {
      toast.error(lang === "fr" ? "L’enregistrement est indisponible dans ce navigateur." : "Saving is unavailable in this browser.");
    }
  }

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  async function saveDataset(file: File, rows: string[][], profile: DatasetProfile) {
    if (rows.length < 2) {
      toast.error(t("Le fichier doit contenir un en-tête et au moins une ligne valide."));
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
    setFileReady({ lignes: profile.rows, colonnes: profile.columns });
    setFileError(false);
    setLastFile(null);
    toast.success(
      t("Fichier « {name} » chargé : {summary} analysées.", {
        name: file.name,
        summary: profileSummary(profile, lang),
      }),
    );
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
            label: t("Voir les offres"),
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
    setLastFile(file);
    setFileError(false);
    setFileReady(null);
    try {
      const parsedRows = isExcel
        ? await parseExcelFile(file)
        : isJson
          ? await parseJsonFile(file)
          : isLas
            ? await parseLasFile(file)
            : await parseCsvFile(file, (ratio) => setUploadProgress(ratio));
      const rows = normalizeDatasetRows(parsedRows);
      setUploadProgress(1);
      if (rows.length < 2) throw new Error("empty");
      const rowCount = rows.length - 1;
      if (rowCount > maxRows(plan)) {
        toast.error(
          `Votre offre accepte jusqu'à ${maxRows(plan).toLocaleString(locale)} lignes ; ce fichier en contient ${rowCount.toLocaleString(locale)}. Passez à l’offre supérieure pour les fichiers plus volumineux.`,
          {
            action: {
              label: t("Voir les offres"),
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
      setFileError(true);
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
      <div className="border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex w-full max-w-[860px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="min-w-0 truncate font-display text-base font-semibold text-foreground">
              {title || t("Nouvelle analyse")}
            </h1>
            <span className="inline-flex min-h-8 max-w-[52vw] items-center gap-2 rounded-full border border-border bg-card px-3 text-xs text-foreground/80 sm:max-w-xs">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  datasetName ? "bg-brand-teal" : "bg-muted-foreground/40"
                }`}
              />
              <span className="truncate" title={datasetName ?? undefined}>
                {datasetName ??
                  (datasetRows !== null
                    ? t("{count} lignes analysées", {
                        count: datasetRows.toLocaleString(locale),
                      })
                    : t("Aucun fichier associé"))}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={domain}
              onValueChange={(value) => setDomain(getAnalysisDomain(value).id)}
            >
              <SelectTrigger
                className="h-9 w-auto min-w-[150px] gap-2 border-border bg-card text-xs"
                title={domainDescription(domain, lang)}
              >
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {ANALYSIS_DOMAINS.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                    title={domainDescription(item.id, lang)}
                  >
                    {domainLabel(item.id, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              title={t("Exporter le rapport PDF — Pro")}
              disabled={busy || exporting || !messages.some((m) => m.role === "assistant")}
              onClick={() => handleExport("pdf")}
              className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              title={t("Exporter le rapport Excel — Pro")}
              disabled={busy || exporting || !messages.some((m) => m.role === "assistant")}
              onClick={() => handleExport("xlsx")}
              className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {datasetName ? t("Remplacer le fichier") : t("Téléverser un fichier")}
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
      </div>

      {!online && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b border-border bg-brand-amber/10 px-4 py-3 text-sm text-brand-ink"
        >
          <DatelloMascot mood="oups" size={32} className="shrink-0" />
          <span>{moments.horsLigne[lang].texte}</span>
        </div>
      )}

      {fileError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 border-b border-border bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <DatelloMascot mood="oups" size={32} className="shrink-0" />
          <span className="min-w-0 flex-1">{moments.erreurFichier[lang].texte}</span>
          {lastFile && (
            <Button
              size="sm"
              onClick={() => lastFile && handleCsvUpload(lastFile)}
              className="min-h-11 shrink-0 gap-2 bg-brand-teal-dark text-white hover:bg-brand-teal"
            >
              <RotateCcw className="h-4 w-4" />
              {moments.erreurFichier[lang].bouton}
            </Button>
          )}
        </div>
      )}

      {uploading && <UploadProgress progress={uploadProgress ?? 0} fileName={uploadName} />}
      {!uploading && processing && (
        <AnalysisProgress phase={processing.phase} startedAt={processing.startedAt} streaming={status === "streaming"} />
      )}
      {analysisError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-destructive"
        >
          <span>{analysisError}</span>
          {/analyses gratuites/i.test(analysisError) && (
            <Button size="sm" onClick={() => navigate({ to: "/pricing" })} className="shrink-0">
              {t("Passer à Pro")}
            </Button>
          )}
        </div>
      )}

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-[860px] gap-6 px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <DatelloMascot mood={moments.accueil.mood} size={120} />
              <h2 className="mt-4 font-display text-2xl font-semibold text-brand-ink">
                {moments.accueil[lang].titre}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {moments.accueil[lang].sousTitre}
              </p>
              <div className="mt-6 flex w-full max-w-xl flex-col gap-2">
                {moments.accueil[lang].suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setDraft(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className="min-h-11 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-left text-sm text-foreground shadow-sm transition-colors hover:border-brand-teal hover:bg-secondary hover:text-brand-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-medium text-brand-teal-dark">
                  <Layers className="h-3 w-3" />
                  {domainLabel(domain, lang)}
                </span>
                <span>{domainDescription(domain, lang)}</span>
              </div>
              {datasetProfile && (
                <div className="mt-6 w-full">
                  <AnalysisOverview profile={datasetProfile} />
                </div>
              )}
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n");

            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand-ink px-4 py-3 text-sm text-white">
                    {text}
                  </div>
                </div>
              );
            }

            const columns = clarificationColumns(text, datasetProfile);
            const missingColumn = m.id === messages.at(-1)?.id ? emptyReferencedColumn(submittedQuestion, datasetProfile) : null;
            const pending = busy && m.id === messages.at(-1)?.id;
            return (
              <div key={m.id} id={`datello-response-${m.id}`} className="flex items-start gap-3">
                <DatelloMascot
                  mood={pending ? "reflechit" : columns.length || missingColumn ? "oups" : "trouve"}
                  size={44}
                  className="mt-1 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 shadow-sm ring-1 ring-border/70">
                    {!pending && <p className="mb-3 text-sm font-semibold text-brand-teal-dark">{columns.length ? moments.questionFloue[lang].texte.replace("{suggestions}", columns.join(", ")) : moments.resultat[lang].texte}</p>}
                    {!pending && missingColumn && <p className="mb-3 text-sm text-muted-foreground">{moments.donneesManquantes[lang].texte.replace("{colonne}", missingColumn).replace("{pourcentage}", "100 %")}</p>}
                    {!pending && columns.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{columns.map((column) => <Button key={column} type="button" variant="secondary" className="min-h-11 rounded-full" onClick={() => { setDraft(column); textareaRef.current?.focus(); }}>{column}</Button>)}</div>}
                    <MessageResponse>
                      {/<(?:!doctype|html|head|body)\b/i.test(text)
                        ? safeAnalysisError(text)
                        : stripChartBlocks(text)}
                    </MessageResponse>
                    {!busy && <AnalysisCharts text={text} preview={datasetPreview} />}
                  </div>
                  {!busy && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(moments.resultat[lang].actions[0]);
                          textareaRef.current?.focus();
                        }}
                        className="min-h-11 rounded-full border border-brand-teal-dark px-4 text-xs font-semibold text-brand-teal-dark transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                      >
                        {moments.resultat[lang].actions[0]}
                      </button>
                      <button
                        type="button"
                        disabled={exporting}
                        onClick={() => exportResponseChart(m.id)}
                        className="min-h-11 rounded-full bg-secondary px-4 text-xs font-semibold text-brand-teal-dark transition-colors hover:bg-brand-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                      >
                        {moments.resultat[lang].actions[1]}
                      </button>
                      <button
                        type="button"
                        onClick={addToDashboard}
                        className="min-h-11 rounded-full bg-secondary px-4 text-xs font-semibold text-brand-teal-dark transition-colors hover:bg-brand-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                      >
                        {moments.resultat[lang].actions[2]}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {fileReady && (
            <div className="flex items-start gap-3">
              <DatelloMascot mood={moments.fichierPret.mood} size={44} className="mt-1 shrink-0" />
              <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm shadow-sm ring-1 ring-border/70">
                <p className="flex items-center gap-2 font-medium text-brand-teal-dark">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>
                    {moments.fichierPret[lang].texte
                      .replace("{lignes}", fileReady.lignes.toLocaleString(locale))
                      .replace("{colonnes}", fileReady.colonnes.toLocaleString(locale))}
                  </span>
                </p>
              </div>
            </div>
          )}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DatelloMascot mood={moments.analyse.mood} size={36} />
              <Shimmer>{moments.analyse[lang].texte}</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background px-4 py-4">
        <div className="mx-auto w-full max-w-[860px]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text || busy || uploading) return;
              setAnalysisError(null);
              setFileError(false);
              setFileReady(null);
              setSubmittedQuestion(text);
              setProcessing({ phase: "ai", startedAt: Date.now() });
              sendMessage({ text });
              setDraft("");
            }}
            className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-brand-teal"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t("Importer un fichier CSV ou Excel")}
              disabled={busy || uploading}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <label htmlFor="datello-question" className="sr-only">
              {t("Posez une question sur vos données…")}
            </label>
            <textarea
              id="datello-question"
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              placeholder={t("Posez une question sur vos données…")}
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => {
                  stop();
                  setProcessing(null);
                }}
                className="min-h-11 rounded-xl bg-brand-teal-dark px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-teal"
              >
                {t("Arrêter")}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() || uploading}
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {t("Analyser")}
              </button>
            )}
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {t(
              "Datello s’appuie sur le profil statistique complet du fichier et un échantillon d’illustration. Vérifiez les chiffres clés.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
