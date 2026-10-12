import { extractMarkdownTables } from "@/lib/export-report";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const num = (v: string) => parseFloat(v.replace(/\s|%/g, "").replace(",", "."));

export function AnalysisCharts({ text }: { text: string }) {
  const table = extractMarkdownTables(text).find((rows) => rows.length > 2 && rows.slice(1).every((r) => Number.isFinite(num(r[1] ?? ""))));
  if (!table) return null;
  const data = table.slice(1, 9).map((row) => ({ label: row[0] ?? "", value: num(row[1] ?? "") }));
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const total = data.reduce((n, d) => n + Math.abs(d.value), 0) || 1;
  let acc = 0;
  const gradient = data.map((d, i) => {
    const start = (acc / total) * 100;
    acc += Math.abs(d.value);
    return `${COLORS[i % COLORS.length]} ${start}% ${(acc / total) * 100}%`;
  }).join(", ");
  return <figure className="mt-5 border-t border-border pt-4">
    <figcaption className="mb-3 text-sm font-semibold">{table[0]?.[1]} — {table[0]?.[0]}</figcaption>
    <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
      <div className="space-y-3">{data.map((d, i) => <div key={`${d.label}-${i}`} className="grid grid-cols-[minmax(70px,1fr)_2fr_60px] items-center gap-3 text-xs">
        <span className="flex items-center gap-2 break-words"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{d.label}</span>
        <div className="h-5 rounded bg-muted"><div className="h-full rounded transition-all" style={{ width: `${Math.abs(d.value) / max * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
        <span className="text-right tabular-nums">{d.value.toLocaleString("fr-FR")}</span>
      </div>)}</div>
      <div aria-hidden className="mx-auto h-28 w-28 rounded-full" style={{ background: `conic-gradient(${gradient})`, mask: "radial-gradient(circle, transparent 45%, black 46%)", WebkitMask: "radial-gradient(circle, transparent 45%, black 46%)" }} />
    </div>
  </figure>;
}
