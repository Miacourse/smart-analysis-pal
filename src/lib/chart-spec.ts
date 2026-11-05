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
const MAX_TOTAL_SPEC_CHARS = 1_200_000;
const MAX_SPEC_DEPTH = 24;
const MAX_SPEC_NODES = 50_000;
const MAX_SPEC_ARRAY = 5_000;
const MAX_SPEC_STRING = 20_000;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const NETWORK_KEYS = new Set([
  "url",
  "href",
  "src",
  "loader",
  "poster",
  "dataurl",
  "baseurl",
  "geojson",
  "topojson",
  "mapbox",
]);
const HTML_TAG_RE = /<\/?[a-z][^>]*>/gi;
const CONTROL_RE = /\p{Cc}/gu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumeric(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const cleaned = value
      .trim()
      .replace(/[\s\u00a0]/g, "")
      .replace("%", "")
      .replace(",", ".");
    return cleaned !== "" && Number.isFinite(Number(cleaned));
  }
  return false;
}

function isUnsafeKey(key: string): boolean {
  return DANGEROUS_KEYS.has(key);
}

function isNetworkKey(key: string, parentKey?: string): boolean {
  const lower = key.toLowerCase();
  if (lower === "source") return parentKey === "images" || parentKey === "image";
  return NETWORK_KEYS.has(lower) || lower.endsWith("src");
}

function sanitizeChartString(value: string): string {
  return value.replace(HTML_TAG_RE, " ").replace(CONTROL_RE, "").slice(0, MAX_SPEC_STRING);
}

function sanitizeDataValue(value: unknown, depth: number, budget: { nodes: number }): unknown {
  if (budget.nodes-- <= 0 || depth > MAX_SPEC_DEPTH) return undefined;
  if (typeof value === "string") return sanitizeChartString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value.slice(0, MAX_SPEC_ARRAY)) {
      const safe = sanitizeDataValue(item, depth + 1, budget);
      if (safe !== undefined) out.push(safe);
    }
    return out;
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (isUnsafeKey(key)) continue;
      const safe = sanitizeDataValue(child, depth + 1, budget);
      if (safe !== undefined) out[key] = safe;
    }
    return out;
  }
  return undefined;
}

function sanitizeDataRows(rows: unknown[]): Record<string, unknown>[] {
  const budget = { nodes: MAX_SPEC_NODES };
  return rows
    .filter(isRecord)
    .slice(0, MAX_SPEC_ARRAY)
    .map((row) => sanitizeDataValue(row, 0, budget))
    .filter(isRecord);
}

type SpecContext = {
  depth: number;
  budget: { nodes: number };
  rows: boolean;
  inDatasets: boolean;
  parentKey: string | undefined;
};

function sanitizeSpecValue(value: unknown, ctx: SpecContext): unknown {
  if (ctx.budget.nodes-- <= 0 || ctx.depth > MAX_SPEC_DEPTH) return undefined;
  if (typeof value === "string") return sanitizeChartString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    const childRows = ctx.rows || ctx.inDatasets;
    const out: unknown[] = [];
    for (const item of value.slice(0, MAX_SPEC_ARRAY)) {
      const safe = sanitizeSpecValue(item, {
        depth: ctx.depth + 1,
        budget: ctx.budget,
        rows: childRows,
        inDatasets: false,
        parentKey: ctx.parentKey,
      });
      if (safe !== undefined) out.push(safe);
    }
    return out;
  }
  if (isRecord(value)) {
    if (ctx.rows) return sanitizeDataValue(value, ctx.depth, ctx.budget);
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (isUnsafeKey(key) || isNetworkKey(key, ctx.parentKey)) continue;
      if (
        key === "type" &&
        typeof child === "string" &&
        /^(?:scatter|choropleth|density)map(?:box)?$/i.test(child)
      ) {
        continue;
      }
      if (
        (key === "width" || key === "height") &&
        typeof child === "number" &&
        (!Number.isFinite(child) || child < 0 || child > 5000)
      ) {
        continue;
      }
      const safe = sanitizeSpecValue(child, {
        depth: ctx.depth + 1,
        budget: ctx.budget,
        rows: key === "values",
        inDatasets: key === "datasets" || ctx.inDatasets,
        parentKey: key,
      });
      if (safe !== undefined) out[key] = safe;
    }
    return out;
  }
  return undefined;
}

function sanitizeSpecNode(value: unknown): unknown {
  return sanitizeSpecValue(value, {
    depth: 0,
    budget: { nodes: MAX_SPEC_NODES },
    rows: false,
    inDatasets: false,
    parentKey: undefined,
  });
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
    (raw["data"] as unknown[]).every(
      (trace) => isRecord(trace) && typeof trace["type"] === "string",
    )
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
  const data = sanitizeDataRows(rawData).slice(0, 200);
  if (data.length === 0) return null;

  const first = data[0] ?? {};
  const keys = Object.keys(first);
  if (keys.length === 0) return null;

  const requestedXKey =
    typeof raw["xKey"] === "string" ? sanitizeChartString(raw["xKey"]).trim() : "";
  if (requestedXKey && isUnsafeKey(requestedXKey)) return null;
  let xKey = requestedXKey.length > 0 ? requestedXKey : (keys[0] ?? "label");

  const requestedYKeys = Array.isArray(raw["yKeys"])
    ? raw["yKeys"]
        .filter((key): key is string => typeof key === "string")
        .map((key) => sanitizeChartString(key).trim())
        .filter((key) => key.length > 0 && !isUnsafeKey(key))
    : [];
  const presentYKeys = requestedYKeys.filter((key) => keys.includes(key));
  let yKeys =
    presentYKeys.length > 0
      ? presentYKeys
      : keys.filter((key) => key !== xKey && data.some((row) => isNumeric(row[key]))).slice(0, 4);

  if (!keys.includes(xKey)) {
    const fallback = keys.find((key) => !yKeys.includes(key)) ?? keys[0];
    if (fallback) xKey = fallback;
  }

  yKeys = yKeys.filter((key) => key !== xKey);
  if (type === "pie" || type === "scatter") yKeys = yKeys.slice(0, 1);
  if (yKeys.length === 0) return null;

  const spec: ChartSpec = { engine: "recharts", type, xKey, yKeys, data };
  if (typeof raw["title"] === "string") {
    const title = sanitizeChartString(raw["title"]).trim();
    if (title) spec.title = title;
  }
  if (raw["stacked"] === true) spec.stacked = true;
  return spec;
}

function vegaDataValues(node: unknown): Record<string, unknown>[] | null {
  if (!isRecord(node)) return null;
  const values = node["values"];
  if (Array.isArray(values)) {
    const rows = values.filter(isRecord);
    if (rows.length > 0) return rows;
  }
  return null;
}

function extractVegaValues(vegaSpec: Record<string, unknown>): Record<string, unknown>[] | null {
  const direct = vegaDataValues(vegaSpec["data"]);
  if (direct) return direct;

  const datasets = vegaSpec["datasets"];
  if (isRecord(datasets)) {
    for (const value of Object.values(datasets)) {
      if (Array.isArray(value)) {
        const rows = value.filter(isRecord);
        if (rows.length > 0) return rows;
      }
    }
  }

  for (const key of ["layer", "concat", "hconcat", "vconcat"]) {
    const children = vegaSpec[key];
    if (Array.isArray(children)) {
      for (const child of children) {
        const rows = vegaDataValues(child) ?? extractVegaValues(isRecord(child) ? child : {});
        if (rows) return rows;
      }
    }
  }

  if (isRecord(vegaSpec["spec"])) return extractVegaValues(vegaSpec["spec"]);
  return null;
}

function encodingField(encoding: unknown, channel: string): string | null {
  if (!isRecord(encoding)) return null;
  const channelSpec = encoding[channel];
  if (!isRecord(channelSpec)) return null;
  const field = channelSpec["field"];
  return typeof field === "string" && field.length > 0 ? field : null;
}

function vegaToRecharts(
  values: Record<string, unknown>[],
  vegaSpec: Record<string, unknown>,
  title: string,
): ChartSpec | null {
  const keys = Object.keys(values[0] ?? {});
  if (keys.length < 2) return null;
  const numericKeys = keys.filter((key) => values.some((row) => isNumeric(row[key])));
  if (numericKeys.length === 0) return null;

  const encoding = vegaSpec["encoding"];
  const xField = encodingField(encoding, "x");
  const yField = encodingField(encoding, "y");

  let xKey = xField && keys.includes(xField) ? xField : null;
  if (!xKey) xKey = keys.find((key) => !numericKeys.includes(key)) ?? keys[0]!;
  if (!xKey) return null;

  let yKeys = yField && keys.includes(yField) && yField !== xKey ? [yField] : [];
  if (yKeys.length === 0) {
    const candidate = numericKeys.find((key) => key !== xKey) ?? numericKeys[0]!;
    if (candidate) yKeys = [candidate];
  }
  yKeys = yKeys.filter((key) => keys.includes(key) && key !== xKey);
  if (yKeys.length === 0) return null;

  const markRaw = vegaSpec["mark"];
  const mark = typeof markRaw === "string" ? markRaw : isRecord(markRaw) ? markRaw["type"] : null;
  const type: ChartType =
    mark === "line"
      ? "line"
      : mark === "area"
        ? "area"
        : mark === "arc"
          ? "pie"
          : mark === "point" || mark === "circle" || mark === "square"
            ? "scatter"
            : "bar";

  const spec: ChartSpec = {
    engine: "recharts",
    type,
    xKey,
    yKeys: yKeys.slice(0, 4),
    data: values.slice(0, 200).map((row) => ({ ...row })),
  };
  if (title) spec.title = title;
  return spec;
}

function normalizeVega(raw: Record<string, unknown>): ChartSpec | null {
  const candidate = isRecord(raw["vegaSpec"]) ? raw["vegaSpec"] : raw;
  const source: Record<string, unknown> = { ...candidate };
  delete source["engine"];
  delete source["title"];
  delete source["vegaSpec"];

  const sanitized = sanitizeSpecNode(source);
  if (!isRecord(sanitized)) return null;
  const vegaSpec = sanitized;

  const looksLikeVega = ["mark", "layer", "facet", "concat", "hconcat", "vconcat", "spec"].some(
    (key) => key in vegaSpec,
  );
  if (!looksLikeVega) return null;

  const spec: ChartSpec = { engine: "vega", vegaSpec };
  const rawTitle =
    typeof raw["title"] === "string"
      ? sanitizeChartString(raw["title"]).trim()
      : typeof vegaSpec["title"] === "string"
        ? sanitizeChartString(vegaSpec["title"]).trim()
        : "";

  const values = extractVegaValues(vegaSpec);
  if (!values) return null;
  const converted = vegaToRecharts(values, vegaSpec, rawTitle);
  if (converted) return converted;

  if (rawTitle) spec.title = rawTitle;
  return spec;
}

function normalizePlotly(raw: Record<string, unknown>): ChartSpec | null {
  const rawTraces = Array.isArray(raw["traces"])
    ? raw["traces"]
    : Array.isArray(raw["data"])
      ? raw["data"]
      : null;
  if (!rawTraces) return null;

  const traces = rawTraces
    .filter(isRecord)
    .filter((trace) => Object.values(trace).some((value) => Array.isArray(value)))
    .filter((trace) => {
      const type = trace["type"];
      return typeof type !== "string" || !/^(?:scatter|choropleth|density)map(?:box)?$/i.test(type);
    })
    .map((trace) => sanitizeSpecNode(trace))
    .filter(isRecord)
    .slice(0, 8);
  if (traces.length === 0) return null;

  const spec: ChartSpec = { engine: "plotly", traces };
  if (typeof raw["title"] === "string") {
    const title = sanitizeChartString(raw["title"]).trim();
    if (title) spec.title = title;
  }
  if (isRecord(raw["layout"])) {
    const layout = sanitizeSpecNode(raw["layout"]);
    if (isRecord(layout)) spec.layout = layout;
  }
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
  const spec =
    engine === "vega"
      ? normalizeVega(raw)
      : engine === "plotly"
        ? normalizePlotly(raw)
        : normalizeRecharts(raw);
  if (!spec) return null;
  try {
    return JSON.stringify(spec).length > MAX_SPEC_CHARS ? null : spec;
  } catch {
    return null;
  }
}

export function parseChartSpecs(text: string, maxSpecs = 24): ChartSpec[] {
  const specs: ChartSpec[] = [];
  if (!text) return specs;
  CHART_BLOCK_RE.lastIndex = 0;
  let totalChars = 0;
  let match: RegExpExecArray | null;
  while ((match = CHART_BLOCK_RE.exec(text)) !== null && specs.length < maxSpecs) {
    const body = match[1]?.trim();
    if (!body) continue;
    totalChars += body.length;
    if (totalChars > MAX_TOTAL_SPEC_CHARS) break;
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
    const cleaned = value
      .trim()
      .replace(/[\s\u00a0]/g, "")
      .replace("%", "")
      .replace(",", ".");
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
  if (isUnsafeKey(xKey)) return [];
  return rows.map((row, index) => {
    const output: Record<string, string | number> = {};
    if (spec.type === "scatter") {
      output[xKey] = toChartNumber(row[xKey]) ?? index;
    } else {
      const label = row[xKey];
      output[xKey] = label === undefined || label === null ? `#${index + 1}` : String(label);
    }
    for (const key of yKeys) {
      if (isUnsafeKey(key)) continue;
      output[key] = toChartNumber(row[key]) ?? 0;
    }
    return output;
  });
}

/** Valeurs textuelles à joindre au graphique statique dans le rapport PDF. */
export function buildChartValueTable(spec: ChartSpec, maxRows = 30): string[][] {
  if (spec.engine !== "recharts" || !spec.xKey || !spec.yKeys?.length) return [];
  const rows = buildChartData(spec).slice(0, Math.max(1, maxRows));
  if (rows.length === 0) return [];
  const header = [spec.xKey, ...spec.yKeys];
  return [
    header,
    ...rows.map((row) =>
      header.map((key) => {
        const value = row[key];
        return typeof value === "number"
          ? value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
          : String(value ?? "");
      }),
    ),
  ];
}
