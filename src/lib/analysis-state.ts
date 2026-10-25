export type AnalysisPhase = "upload" | "parsing" | "ai" | "charts";

export const ANALYSIS_STEPS = [
  { phase: "upload", label: "Upload du CSV", min: 0, max: 25 },
  { phase: "parsing", label: "Lecture & parsing du fichier", min: 25, max: 50 },
  { phase: "ai", label: "Analyse par l’IA", min: 50, max: 90 },
  { phase: "charts", label: "Génération des graphiques", min: 90, max: 100 },
] as const;

export function estimatedProgress(phase: AnalysisPhase, elapsedMs: number) {
  const step = ANALYSIS_STEPS.find((s) => s.phase === phase);
  if (!step) return 0;
  return Math.min(
    step.max - 1,
    Math.floor(step.min + (step.max - step.min - 1) * (1 - Math.exp(-elapsedMs / 15000))),
  );
}

export function showLongAnalysisNotice(elapsedMs: number) {
  return elapsedMs > 10000;
}

const SERVICE_UNAVAILABLE =
  "Le service d’analyse est momentanément indisponible. Réessayez dans quelques instants.";

// Erreurs du fournisseur d'IA (crédits épuisés, quota, facturation) : on affiche un
// message clair plutôt qu'un « Payment Required » brut, sans le confondre avec la
// limite d'analyses gratuites de l'application.
function isProviderQuotaError(value: string): boolean {
  if (/analyses gratuites/i.test(value)) return false;
  return /payment required|insufficient[_ ]?(quota|credits)|exceeded your current quota|out of credits|billing/i.test(
    value,
  );
}

// Erreurs techniques du fournisseur (clé refusée, API désactivée, 5xx, échec après
// plusieurs tentatives) : on évite d'exposer « Failed after 3 attempts… » à l'utilisateur.
function isProviderRequestError(value: string): boolean {
  return /failed after \d+ attempts|AI_APICallError|APICallError|AI_RetryError|response error|internal error encountered|permission_denied|referrer_blocked|generative language api/i.test(
    value,
  );
}

export function safeAnalysisError(value: string): string {
  if (/<(?:!doctype|html|head|body)\b/i.test(value)) {
    return "L’analyse n’a pas pu aboutir. Votre conversation est conservée. Relancez l’analyse.";
  }
  if (isProviderQuotaError(value)) return SERVICE_UNAVAILABLE;
  if (isProviderRequestError(value)) return SERVICE_UNAVAILABLE;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed.error === "string"
      ? safeAnalysisError(parsed.error)
      : typeof parsed.message === "string"
        ? safeAnalysisError(parsed.message)
        : "L’analyse n’a pas pu aboutir.";
  } catch {
    return value || "L’analyse n’a pas pu aboutir.";
  }
}

export async function analysisFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.headers.get("content-type")?.includes("text/html")) {
    return Response.json(
      { error: safeAnalysisError("<!doctype html>") },
      { status: response.ok ? 502 : response.status },
    );
  }
  return response;
}
