import { useEffect, useRef, useState } from "react";
import Plotly from "plotly.js-dist-min";

export default function PlotlyChart({
  traces,
  layout,
  title,
}: {
  traces: Record<string, unknown>[];
  layout?: Record<string, unknown> | undefined;
  title?: string | undefined;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    setFailed(false);

    const isDark =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const foreground = isDark ? "#e5e7eb" : "#374151";
    const grid = isDark ? "#374151" : "#e5e7eb";

    const baseLayout: Record<string, unknown> = {
      autosize: true,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: foreground, size: 12 },
      hoverlabel: { font: { color: foreground } },
      margin: { l: 56, r: 24, t: title ? 52 : 24, b: 52 },
      xaxis: { gridcolor: grid, zerolinecolor: grid, automargin: true },
      yaxis: { gridcolor: grid, zerolinecolor: grid, automargin: true },
      ...(title ? { title: { text: title, font: { size: 14, color: foreground } } } : {}),
      ...(layout ?? {}),
    };

    void Plotly.newPlot(element, traces as never, baseLayout as never, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
    }).catch(() => {
      setFailed(true);
    });

    return () => {
      Plotly.purge(element);
    };
  }, [traces, layout, title]);

  if (failed) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
        Graphique indisponible pour ces données.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ minHeight: 360 }} />;
}
