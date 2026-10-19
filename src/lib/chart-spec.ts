export type ChartType = "bar" | "line" | "area" | "pie" | "scatter";

export interface ChartSpec {
  type: ChartType;
  title?: string;
  xKey: string;
  yKeys: string[];
  data: Record<string, unknown>[];
  stacked?: boolean;
}

const CHART_TYPES: ChartType[] = ["bar", "line", "area", "pie", "scatter"];
const CHART_BLOCK_RE = /```chart\s*([\s\S]*?)```/gi;

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

function normalizeChartSpec(raw: unknown): ChartSpec | null {
  if (!isRecord(raw)) return null;

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

  const spec: ChartSpec = { type, xKey, yKeys, data };
  if (typeof raw["title"] === "string" && raw["title"].trim().length > 0) {
    spec.title = raw["title"].trim();
  }
  if (raw["stacked"] === true) spec.stacked = true;
  return spec;
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
  return spec.data.map((row, index) => {
    const output: Record<string, string | number> = {};
    if (spec.type === "scatter") {
      output[spec.xKey] = toChartNumber(row[spec.xKey]) ?? index;
    } else {
      const label = row[spec.xKey];
      output[spec.xKey] = label === undefined || label === null ? `#${index + 1}` : String(label);
    }
    for (const key of spec.yKeys) {
      output[key] = toChartNumber(row[key]) ?? 0;
    }
    return output;
  });
}
