import { extractMarkdownTables } from "@/lib/export-report";

export function AnalysisCharts({ text }: { text: string }) {
  const table = extractMarkdownTables(text).find((rows) => rows.length > 2 && rows.slice(1).every((r) => Number.isFinite(parseFloat(r[1]?.replace(/\s|%/g, "").replace(",", ".")))));
  if (!table) return null;
  const data = table.slice(1, 9).map((row) => ({ label: row[0], value: parseFloat(row[1].replace(/\s|%/g, "").replace(",", ".")) }));
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return <figure className="mt-5 border-t border-border pt-4">
    <figcaption className="mb-3 text-sm font-semibold">{table[0][1]} — {table[0][0]}</figcaption>
    <div className="space-y-3">{data.map((d, i) => <div key={`${d.label}-${i}`} className="grid grid-cols-[minmax(70px,1fr)_2fr_60px] items-center gap-3 text-xs">
      <span className="break-words">{d.label}</span><div className="h-5 bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.abs(d.value) / max * 100}%` }} /></div><span className="text-right tabular-nums">{d.value.toLocaleString("fr-FR")}</span>
    </div>)}</div>
  </figure>;
}