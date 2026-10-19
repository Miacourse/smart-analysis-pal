export type ChartEngine = "recharts" | "vega" | "plotly";
export type ChartType = "bar" | "line" | "area" | "pie" | "scatter";

export interface ChartSpec {
  engine: ChartEngine;
  type?: ChartType;
  title?: string;
  xKey?: string;
  yKeys?: string[];
  data?: Record<string, unknown>[];
  stacked?: boolean;
  vegaSpec?: Record<string, unknown>;
  traces?: Record<string, unknown>[];
  layout?: Record<string, unknown>;
}

const CHART_TYPES: ChartType[] = ["bar", "line", "area", "pie", "scatter"];
const CHART_BLOCK_RE = /```chart\s*([\s\S]*?)```/gi;
const MAX_SPEC_CHARS = 300_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumeric(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[\s\u00a0]/g, "").replace("%", "").replace(",", ".");
    return cleaned !== "" && Number.isFinite(Number(cleaned));
  }
  return false;
}

export function stripChartBlocks(text: string): string {
  return text
    .replace(CHART_BLOCK_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectEngine(raw: Record<string, unknown>): ChartEngine {
  const explicit = raw["engine"];
  if (explicit === "vega" || explicit === "plotly" || explicit === "recharts") return explicit;
  if (
    isRecord(raw["vegaSpec"]) ||
    "$schema" in raw ||
    "mark" in raw ||
    "layer" in raw ||
    "facet" in raw ||
    "concat" in raw ||
    "hconcat" in raw ||
    "vconcat" in raw
  ) {
    return "vega";
  }
  if (Array.isArray(raw["traces"])) return "plotly";
  if (
    isRecord(raw["layout"]) &&
    Array.isArray(raw["data"]) &&
    (raw["data"] as unknown[]).every((trace) => isRecord(trace) && typeof trace["type"] === "string")
  ) {
    return "plotly";
  }
  return "recharts";
}

function normalizeRecharts(raw: Record<string, unknown>): ChartSpec | null {
  const requestedType = raw["type"];
  const type: ChartType =
    typeof requestedType === "string" && (CHART_TYPES as string[]).includes(requestedType)
      ? (requestedType as ChartType)
      : "bar";

  const rawData = Array.isArray(raw["data"]) ? raw["data"] : null;
  if (!rawData) return null;
  const data = rawData.filter(isRecord).slice(0, 200);
  if (data.length === 0) return null;

  const first = data[0] ?? {};
  const keys = Object.keys(first);
  if (keys.length === 0) return null;

  let xKey =
    typeof raw["xKey"] === "string" && raw["xKey"].length > 0 ? raw["xKey"] : (keys[0] ?? "label");

  const requestedYKeys = Array.isArray(raw["yKeys"])
    ? raw["yKeys"].filter((key): key is string => typeof key === "string" && key.length > 0)
    : [];
  let yKeys =
    requestedYKeys.length > 0
      ? requestedYKeys
      : keys.filter((key) => key !== xKey && data.some((row) => isNumeric(row[key]))).slice(0, 4);

  if (!keys.includes(xKey)) {
    const fallback = keys.find((key) => !yKeys.includes(key)) ?? keys[0];
    if (fallback) xKey = fallback;
  }

  yKeys = yKeys.filter((key) => key !== xKey);
  if (type === "pie" || type === "scatter") yKeys = yKeys.slice(0, 1);
  if (yKeys.length === 0) return null;

  const spec: ChartSpec = { engine: "recharts", type, xKey, yKeys, data };
  if (typeof raw["title"] === "string" && raw["title"].trim().length > 0) {
    spec.title = raw["title"].trim();
  }
  if (raw["stacked"] === true) spec.stacked = true;
  return spec;
}

function normalizeVega(raw: Record<string, unknown>): ChartSpec | null {
  const candidate = isRecord(raw["vegaSpec"]) ? raw["vegaSpec"] : raw;
  const vegaSpec: Record<string, unknown> = { ...candidate };
  delete vegaSpec["engine"];
  delete vegaSpec["title"];
  delete vegaSpec["vegaSpec"];

  const looksLikeVega = ["mark", "layer", "facet", "concat", "hconcat", "vconcat", "spec"].some(
    (key) => key in vegaSpec,
  );
  if (!looksLikeVega) return null;
  if (!("data" in vegaSpec) && !("datasets" in vegaSpec) && !("transform" in vegaSpec) && !("layer" in vegaSpec)) {
    return null;
  }

  const spec: ChartSpec = { engine: "vega", vegaSpec };
  const title =
    typeof raw["title"] === "string"
      ? raw["title"].trim()
      : typeof vegaSpec["title"] === "string"
        ? vegaSpec["title"].trim()
        : "";
  if (title) spec.title = title;
  return spec;
}

function normalizePlotly(raw: Record<string, unknown>): ChartSpec | null {
  const rawTraces = Array.isArray(raw["traces"])
    ? raw["traces"]
    : Array.isArray(raw["data"])
      ? raw["data"]
      : null;
  if (!rawTraces) return null;

  const traces = rawTraces.filter(isRecord).slice(0, 8);
  if (traces.length === 0) return null;

  const spec: ChartSpec = { engine: "plotly", traces };
  if (typeof raw["title"] === "string" && raw["title"].trim().length > 0) {
    spec.title = raw["title"].trim();
  }
  if (isRecord(raw["layout"])) spec.layout = raw["layout"];
  return spec;
}

function normalizeChartSpec(raw: unknown): ChartSpec | null {
  if (!isRecord(raw)) return null;
  try {
    if (JSON.stringify(raw).length > MAX_SPEC_CHARS) return null;
  } catch {
    return null;
  }

  const engine = detectEngine(raw);
  if (engine === "vega") return normalizeVega(raw);
  if (engine === "plotly") return normalizePlotly(raw);
  return normalizeRecharts(raw);
}

export function parseChartSpecs(text: string, maxSpecs = 3): ChartSpec[] {
  const specs: ChartSpec[] = [];
  if (!text) return specs;
  CHART_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CHART_BLOCK_RE.exec(text)) !== null && specs.length < maxSpecs) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const spec = normalizeChartSpec(JSON.parse(body) as unknown);
      if (spec) specs.push(spec);
    } catch {
      // Bloc invalide ignoré.
    }
  }
  return specs;
}

export function toChartNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[\s\u00a0]/g, "").replace("%", "").replace(",", ".");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function buildChartData(spec: ChartSpec): Record<string, string | number>[] {
  const rows = spec.data ?? [];
  const xKey = spec.xKey ?? "";
  const yKeys = spec.yKeys ?? [];
  return rows.map((row, index) => {
    const output: Record<string, string | number> = {};
    if (spec.type === "scatter") {
      output[xKey] = toChartNumber(row[xKey]) ?? index;
    } else {
      const label = row[xKey];
      output[xKey] = label === undefined || label === null ? `#${index + 1}` : String(label);
    }
    for (const key of yKeys) {
      output[key] = toChartNumber(row[key]) ?? 0;
    }
    return output;
  });
}
