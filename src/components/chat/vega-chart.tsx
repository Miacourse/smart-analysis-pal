import { useEffect, useRef, useState } from "react";
import embed from "vega-embed";
import { loader as createLoader, type Loader } from "vega";
import { useLang } from "@/lib/i18n";

const SAFE_RESOURCE = /^(data|blob):/i;

function safeLoader(): Loader {
  const base = createLoader();
  return {
    ...base,
    load: (uri, options) => {
      if (typeof uri !== "string" || !SAFE_RESOURCE.test(uri)) {
        return Promise.reject(new Error("External Vega resources are blocked"));
      }
      return base.load(uri, options);
    },
    sanitize: (uri, options) => {
      if (typeof uri !== "string" || !SAFE_RESOURCE.test(uri)) {
        return Promise.resolve({ href: "" });
      }
      return base.sanitize(uri, options);
    },
    http: () => Promise.reject(new Error("External Vega resources are blocked")),
    file: () => Promise.reject(new Error("External Vega resources are blocked")),
  };
}

export default function VegaChart({
  spec,
  title,
}: {
  spec: Record<string, unknown>;
  title?: string | undefined;
}) {
  const { t } = useLang();
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

    void embed(element, fullSpec as never, {
      actions: false,
      renderer: "canvas",
      loader: safeLoader(),
    })
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
        {t("Graphique indisponible pour ces données.")}
      </div>
    );
  }

  return <div ref={containerRef} className="w-full overflow-x-auto" />;
}
