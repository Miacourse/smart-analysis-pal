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

function RechartsBody({ spec }: { spec: ChartSpec }) {
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
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
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
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
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
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
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
    <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
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

const num = (value: string) => parseFloat(value.replace(/\s|%/g, "").replace(",", "."));

function MarkdownTableChart({ text }: { text: string }) {
  const table = extractMarkdownTables(text).find(
    (rows) => rows.length > 2 && rows.slice(1).every((r) => Number.isFinite(num(r[1] ?? ""))),
  );
  if (!table) return null;
  const data = table
    .slice(1)
    .filter((r) => !/^\**\s*(total|ensemble|somme)/i.test(r[0] ?? ""))
    .slice(0, 12)
    .map((row) => ({ label: row[0] ?? "", value: num(row[1] ?? "") }));
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
        {table[0]?.[1]} — {table[0]?.[0]}
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

export function AnalysisCharts({ text }: { text: string }) {
  const specs = useMemo(() => parseChartSpecs(text), [text]);
  if (specs.length > 0) {
    return (
      <div className="mt-5 space-y-5 border-t border-border pt-4">
        {specs.map((spec, index) => (
          <SpecChart key={`${spec.engine}-${spec.title ?? "chart"}-${index}`} spec={spec} />
        ))}
      </div>
    );
  }
  return <MarkdownTableChart text={text} />;
}
