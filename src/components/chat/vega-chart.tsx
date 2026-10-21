import { useEffect, useRef, useState } from "react";
import embed from "vega-embed";

export default function VegaChart({
  spec,
  title,
}: {
  spec: Record<string, unknown>;
  title?: string | undefined;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    setFailed(false);
    let view: { finalize: () => void } | null = null;
    let cancelled = false;

    const fullSpec = {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      autosize: { type: "fit", contains: "padding", resize: true },
      config: { background: "transparent", view: { stroke: null } },
      ...(title ? { title } : {}),
      ...spec,
    };

    void embed(element, fullSpec as never, { actions: false, renderer: "canvas" })
      .then((result) => {
        if (cancelled) result.finalize();
        else view = result;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      view?.finalize();
    };
  }, [spec, title]);

  if (failed) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
        Graphique indisponible pour ces données.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full overflow-x-auto" />;
}
