import { useEffect, useState } from "react";
import { Check, Upload, FileSearch, BrainCircuit, ChartColumn, LoaderCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ANALYSIS_STEPS, estimatedProgress, showLongAnalysisNotice, type AnalysisPhase } from "@/lib/analysis-state";

const icons = [Upload, FileSearch, BrainCircuit, ChartColumn];

export function AnalysisProgress({ phase, startedAt }: { phase: AnalysisPhase; startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  const [phaseStart, setPhaseStart] = useState(Date.now());
  useEffect(() => { setPhaseStart(Date.now()); }, [phase]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const current = ANALYSIS_STEPS.findIndex((s) => s.phase === phase);
  const percent = estimatedProgress(phase, Math.max(0, now - phaseStart));
  return (
    <div className="border-b border-border bg-secondary/40 px-4 py-4" role="status" aria-live="polite">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3 text-sm font-medium">
          <span className="flex items-center gap-2"><LoaderCircle className="size-4 motion-safe:animate-spin" />{ANALYSIS_STEPS[current]?.label}</span>
          <span className="tabular-nums text-primary">{percent} %</span>
        </div>
        <Progress value={percent} aria-label="Progression estimée de l’analyse" className="mt-3" />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {ANALYSIS_STEPS.map((step, i) => {
            const Icon = current > i ? Check : icons[i];
            return <div key={step.phase} className={`flex flex-col gap-1 text-xs sm:flex-row sm:items-center ${i <= current ? "text-primary" : "text-muted-foreground"}`}><Icon className="size-4 shrink-0" /><span>{step.label}</span></div>;
          })}
        </div>
        {showLongAnalysisNotice(now - startedAt) && <p className="mt-3 text-xs text-muted-foreground">Analyse en cours, cela peut prendre 30s pour les gros fichiers</p>}
      </div>
    </div>
  );
}