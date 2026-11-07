import { useEffect, useState } from "react";
import { Check, LoaderCircle, FileSearch } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DatelloMascot } from "@/components/brand/DatelloMascot";
import { useLang } from "@/lib/i18n";
import { moments } from "@/lib/messages";
import { analysisStep } from "@/lib/brand-state";
import {
  estimatedProgress,
  showLongAnalysisNotice,
  type AnalysisPhase,
} from "@/lib/analysis-state";

export function UploadProgress({
  progress,
  fileName,
}: {
  progress: number;
  fileName: string | null;
}) {
  const { t, lang } = useLang();
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const done = percent >= 100;
  return (
    <div
      className="border-b border-border bg-secondary/40 px-4 py-4"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[860px] items-start gap-3">
        <DatelloMascot mood={moments.importEnCours.mood} size={36} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              {done ? (
                <Check className="size-4 text-primary" />
              ) : (
                <LoaderCircle className="size-4 motion-safe:animate-spin" />
              )}
              {done
                ? t("Fichier prêt")
                : fileName
                  ? moments.importEnCours[lang].texte.replace("{fichier}", fileName)
                  : t("Téléversement & lecture du fichier…")}
            </span>
            <span className="tabular-nums text-primary">{percent} %</span>
          </div>
          <Progress
            value={percent}
            aria-label={t("Progression du téléversement")}
            className="mt-3"
          />
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <FileSearch className="size-4 shrink-0" />
            <span>
              {lang === "fr"
                ? "Lecture et contrôle des données : doublons, valeurs manquantes et formats."
                : "Reading and checking data: duplicates, missing values and formats."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnalysisProgress({
  phase,
  startedAt,
  streaming = false,
}: {
  phase: AnalysisPhase;
  startedAt: number;
  streaming?: boolean;
}) {
  const { t, lang } = useLang();
  const [now, setNow] = useState(Date.now());
  const [phaseStart, setPhaseStart] = useState(Date.now());
  useEffect(() => {
    setPhaseStart(Date.now());
  }, [phase]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const percent = estimatedProgress(phase, Math.max(0, now - phaseStart));
  const indeterminate = phase === "upload" || phase === "parsing";
  const completed = analysisStep(phase, streaming);
  const steps = moments.analyse[lang].etapes;
  return (
    <div
      className="border-b border-border bg-secondary/40 px-4 py-4"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[860px] items-start gap-3">
        <DatelloMascot mood={moments.analyse.mood} size={40} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-4 motion-safe:animate-spin" />
              {moments.analyse[lang].texte}
            </span>
            <span className="tabular-nums text-primary">
              {indeterminate ? "…" : `${percent} %`}
            </span>
          </div>
          {indeterminate ? (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 rounded-full bg-primary motion-safe:animate-pulse" />
            </div>
          ) : (
            <Progress
              value={percent}
              aria-label={t("Progression estimée de l’analyse")}
              className="mt-3"
            />
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {steps.map((step, index) => {
              const isDone = index < completed;
              const isActive = index === completed;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-1.5 text-xs ${
                    isDone || isActive ? "text-brand-teal-dark" : "text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <Check className="size-4 shrink-0" />
                  ) : isActive ? (
                    <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" />
                  ) : (
                    <span className="size-4 shrink-0 rounded-full border border-current" />
                  )}
                  <span>{step}</span>
                </div>
              );
            })}
          </div>
          {showLongAnalysisNotice(now - startedAt) && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("Analyse en cours, cela peut prendre 30s pour les gros fichiers")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
