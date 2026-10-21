import { Suspense, lazy, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { extractMarkdownTables } from "@/lib/export-report";
import { geoTrafficFromPreview } from "@/lib/geo";
import { GeoMap } from "@/components/chat/geo-map";
import { buildChartData, parseChartSpecs, toChartNumber, type ChartSpec } from "@/lib/chart-spec";

const VegaChart = lazy(() => import("./vega-chart"));
const PlotlyChart = lazy(() => import("./plotly-chart"));

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const colorAt = (index: number) => COLORS[index % COLORS.length] ?? "var(--chart-1)";
const tickStyle = { fill: "var(--muted-foreground)", fontSize: 11 };
const axisLine = { stroke: "var(--border)" };

function formatValue(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("fr-FR") : String(value ?? "");
}

function tooltipNode() {
  return (
    <Tooltip
      formatter={(value) => formatValue(value)}
      contentStyle={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 12,
        color: "var(--foreground)",
      }}
      labelStyle={{ color: "var(--foreground)" }}
    />
  );
}

function RechartsBody({
  spec,
  width,
  height,
}: {
  spec: ChartSpec;
  width?: number | undefined;
  height?: number | undefined;
}) {
  const data = useMemo(() => buildChartData(spec), [spec]);
  const yKeys = spec.yKeys ?? [];
  const xKey = spec.xKey ?? "x";
  const pieData = useMemo(
    () =>
      (spec.data ?? []).map((row, index) => ({
        name: row[xKey] === undefined ? `#${index + 1}` : String(row[xKey]),
        value: toChartNumber(row[yKeys[0] ?? ""]) ?? 0,
      })),
    [spec, xKey, yKeys],
  );

  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />;
  const legend = yKeys.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null;

  if (spec.type === "pie") {
    return (
      <PieChart width={width ?? 0} height={height ?? 0} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        {tooltipNode()}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="78%" paddingAngle={2}>
          {pieData.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={colorAt(index)} />
          ))}
        </Pie>
      </PieChart>
    );
  }

  if (spec.type === "scatter") {
    const yKey = yKeys[0] ?? "";
    return (
      <ScatterChart width={width ?? 0} height={height ?? 0} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        {grid}
        <XAxis type="number" dataKey={xKey} name={xKey} tick={tickStyle} axisLine={axisLine} tickLine={axisLine} />
        <YAxis type="number" dataKey={yKey} name={yKey} tick={tickStyle} axisLine={axisLine} tickLine={axisLine} width={48} />
        {tooltipNode()}
        <Scatter name={yKey} data={data} fill={colorAt(0)} />
      </ScatterChart>
    );
  }

  const xAxis = (
    <XAxis
      dataKey={xKey}
      tick={tickStyle}
      axisLine={axisLine}
      tickLine={axisLine}
      interval={0}
      angle={-18}
      textAnchor="end"
      height={62}
    />
  );
  const yAxis = <YAxis tick={tickStyle} axisLine={axisLine} tickLine={axisLine} width={52} />;

  if (spec.type === "line") {
    return (
      <LineChart width={width ?? 0} height={height ?? 0} data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        {grid}
        {xAxis}
        {yAxis}
        {tooltipNode()}
        {legend}
        {yKeys.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colorAt(index)}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    );
  }

  if (spec.type === "area") {
    return (
      <AreaChart width={width ?? 0} height={height ?? 0} data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        {grid}
        {xAxis}
        {yAxis}
        {tooltipNode()}
        {legend}
        {yKeys.map((key, index) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colorAt(index)}
            fill={colorAt(index)}
            fillOpacity={0.25}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    );
  }

  return (
    <BarChart width={width ?? 0} height={height ?? 0} data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
      {grid}
      {xAxis}
      {yAxis}
      {tooltipNode()}
      {legend}
      {yKeys.map((key, index) => (
        <Bar
          key={key}
          dataKey={key}
          fill={colorAt(index)}
          radius={[4, 4, 0, 0]}
          {...(spec.stacked ? { stackId: "stack" } : {})}
        />
      ))}
    </BarChart>
  );
}

function ChartLoading() {
  return (
    <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
      Chargement du graphique…
    </div>
  );
}

const DEFAULT_TITLES: Record<ChartSpec["engine"], string> = {
  recharts: "Graphique",
  vega: "Graphique statistique",
  plotly: "Visualisation scientifique",
};

function SpecChart({ spec }: { spec: ChartSpec }) {
  const title = spec.title ?? DEFAULT_TITLES[spec.engine];
  return (
    <figure className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <figcaption className="mb-3 text-sm font-semibold">{title}</figcaption>
      {spec.engine === "vega" && spec.vegaSpec ? (
        <Suspense fallback={<ChartLoading />}>
          <VegaChart spec={spec.vegaSpec} title={spec.title} />
        </Suspense>
      ) : spec.engine === "plotly" && spec.traces ? (
        <Suspense fallback={<ChartLoading />}>
          <PlotlyChart traces={spec.traces} layout={spec.layout} title={spec.title} />
        </Suspense>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBody spec={spec} />
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

const stripNum = (value: string) => {
  const cleaned = value
    .replace(/[\s\u00a0]/g, "")
    .replace(/[€$£%]/g, "")
    .replace(",", ".");
  return cleaned === "" ? Number.NaN : Number(cleaned);
};

function parseCsvPreview(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function autoSpecFromPreview(preview: string | null | undefined): ChartSpec | null {
  if (!preview || !preview.trim()) return null;
  const rows = parseCsvPreview(preview);
  if (rows.length < 3) return null;
  const header = (rows[0] ?? []).map((name, index) => name.trim() || `Colonne ${index + 1}`);
  const body = rows.slice(1).filter((row) => row.length === header.length);
  if (body.length < 2 || header.length < 2) return null;

  let category = -1;
  let numeric = -1;
  for (let c = 0; c < header.length; c++) {
    const values = body.map((row) => (row[c] ?? "").trim()).filter(Boolean);
    if (values.length === 0) continue;
    const numbers = values.filter((value) => Number.isFinite(stripNum(value))).length;
    if (numbers / values.length >= 0.8) {
      if (numeric < 0) numeric = c;
      continue;
    }
    const distinct = new Set(values);
    if (category < 0 && distinct.size >= 2 && distinct.size <= 12) category = c;
  }
  if (category < 0 || numeric < 0) return null;

  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of body) {
    const key = (row[category] ?? "").trim();
    const value = stripNum(row[numeric] ?? "");
    if (!key || !Number.isFinite(value)) continue;
    const current = buckets.get(key) ?? { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    buckets.set(key, current);
  }
  const numericKey = header[numeric] ?? "Valeur";
  const categoryKey = header[category] ?? "Catégorie";
  const data = [...buckets.entries()]
    .map(([key, bucket]) => ({
      [categoryKey]: key,
      [numericKey]: Number((bucket.sum / bucket.count).toFixed(2)),
    }))
    .slice(0, 12);
  if (data.length < 2) return null;
  return {
    engine: "recharts",
    type: "bar",
    title: `${numericKey} moyen par ${categoryKey}`,
    xKey: categoryKey,
    yKeys: [numericKey],
    data,
  };
}

function num(value: string) {
  return stripNum(value);
}

function MarkdownTableChart({ text }: { text: string }) {
  const tables = extractMarkdownTables(text);
  let table: string[][] | undefined;
  let valueIndex = 1;
  for (const rows of tables) {
    if (rows.length < 3) continue;
    const width = rows[0]?.length ?? 0;
    for (let c = 1; c < width; c++) {
      if (rows.slice(1).every((row) => Number.isFinite(stripNum(row[c] ?? "")))) {
        table = rows;
        valueIndex = c;
        break;
      }
    }
    if (table) break;
  }
  if (!table) return null;
  const data = table
    .slice(1)
    .filter((r) => !/^\**\s*(total|ensemble|somme)/i.test(r[0] ?? ""))
    .slice(0, 12)
    .map((row) => ({ label: row[0] ?? "", value: num(row[valueIndex] ?? "") }));
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const total = data.reduce((n, d) => n + Math.abs(d.value), 0) || 1;
  let accumulated = 0;
  const gradient = data
    .map((d, i) => {
      const start = (accumulated / total) * 100;
      accumulated += Math.abs(d.value);
      return `${colorAt(i)} ${start}% ${(accumulated / total) * 100}%`;
    })
    .join(", ");
  return (
    <figure className="mt-5 border-t border-border pt-4">
      <figcaption className="mb-3 text-sm font-semibold">
        {table[0]?.[valueIndex]} — {table[0]?.[0]}
      </figcaption>
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          {data.map((d, i) => (
            <div key={`${d.label}-${i}`} className="grid grid-cols-[minmax(70px,1fr)_2fr_60px] items-center gap-3 text-xs">
              <span className="flex items-center gap-2 break-words">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorAt(i) }} />
                {d.label}
              </span>
              <div className="h-5 rounded bg-muted">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${(Math.abs(d.value) / max) * 100}%`, background: colorAt(i) }}
                />
              </div>
              <span className="text-right tabular-nums">{d.value.toLocaleString("fr-FR")}</span>
            </div>
          ))}
        </div>
        <div
          aria-hidden
          className="mx-auto h-28 w-28 rounded-full"
          style={{
            background: `conic-gradient(${gradient})`,
            mask: "radial-gradient(circle, transparent 45%, black 46%)",
            WebkitMask: "radial-gradient(circle, transparent 45%, black 46%)",
          }}
        />
      </div>
    </figure>
  );
}

export function AnalysisCharts({
  text,
  preview,
}: {
  text: string;
  preview?: string | null;
}) {
  const specs = useMemo(() => parseChartSpecs(text), [text]);
  const auto = useMemo(
    () => (specs.length > 0 ? null : autoSpecFromPreview(preview)),
    [specs.length, preview],
  );
  const geo = useMemo(() => geoTrafficFromPreview(preview), [preview]);

  const geoBlock = geo ? (
    <GeoMap
      points={geo.points}
      valueLabel={geo.valueColumn}
      caption={`Source : colonne ${geo.labelColumn} du fichier, agrégée par ${geo.valueColumn === "Volume" ? "nombre de lignes" : geo.valueColumn}.`}
    />
  ) : null;

  if (specs.length > 0) {
    return (
      <div className="mt-5 space-y-5 border-t border-border pt-4">
        {geoBlock}
        {specs.map((spec, index) => (
          <SpecChart key={`${spec.engine}-${spec.title ?? "chart"}-${index}`} spec={spec} />
        ))}
      </div>
    );
  }
  if (auto || geo) {
    return (
      <div className="mt-5 space-y-4 border-t border-border pt-4">
        {geoBlock}
        {auto && <SpecChart spec={auto} />}
        <p className="text-[11px] text-muted-foreground">
          Graphique généré automatiquement à partir du fichier.
        </p>
      </div>
    );
  }
  return <MarkdownTableChart text={text} />;
}




