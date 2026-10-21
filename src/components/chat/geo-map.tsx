import { useEffect, useMemo, useRef, useState } from "react";

type Leaflet = any;

declare global {
  interface Window {
    L?: Leaflet;
    __leafletPromise?: Promise<Leaflet>;
  }
}

const CSS_ID = "leaflet-css";

function loadLeaflet(): Promise<Leaflet> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.L) return Promise.resolve(window.L);
  if (window.__leafletPromise) return window.__leafletPromise;
  window.__leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById(CSS_ID)) {
      const link = document.createElement("link");
      link.id = CSS_ID;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.crossOrigin = "";
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("leaflet missing")));
    script.onerror = () => reject(new Error("leaflet load failed"));
    document.head.appendChild(script);
  });
  return window.__leafletPromise;
}

export type MapPoint = { label: string; lat: number; lng: number; value: number };

const formatValue = (value: number) =>
  Number.isInteger(value)
    ? value.toLocaleString("fr-FR")
    : value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export function GeoMap({
  points,
  valueLabel,
  height = 340,
  caption,
}: {
  points: MapPoint[];
  valueLabel: string;
  height?: number;
  caption?: string;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const max = useMemo(() => Math.max(1, ...points.map((point) => Math.abs(point.value))), [points]);
  const top = useMemo(
    () => [...points].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 6),
    [points],
  );

  useEffect(() => {
    let map: any = null;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !holder.current) return;
        map = L.map(holder.current, {
          center: [24, 10],
          zoom: 2,
          scrollWheelZoom: false,
          worldCopyJump: true,
          attributionControl: true,
        });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: "abcd",
          maxZoom: 12,
        }).addTo(map);
        for (const point of points) {
          const weight = Math.abs(point.value) / max;
          L.circleMarker([point.lat, point.lng], {
            radius: 6 + 24 * Math.sqrt(weight),
            color: "#0f766e",
            weight: 1.5,
            fillColor: "#14b8a6",
            fillOpacity: 0.55,
          })
            .bindTooltip(`${point.label} : ${formatValue(point.value)} ${valueLabel}`, {
              direction: "top",
            })
            .bindPopup(
              `<strong>${point.label}</strong><br/>${formatValue(point.value)} ${valueLabel}`,
            )
            .addTo(map);
        }
        if (points.length > 0) {
          map.fitBounds(
            points.map((point) => [point.lat, point.lng]),
            { padding: [30, 30], maxZoom: 4 },
          );
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [points, max, valueLabel]);

  if (failed) {
    return (
      <p className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        Carte indisponible (chargement bloqué). Les données restent visibles dans le tableau.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Répartition géographique</p>
        <p className="text-[11px] text-muted-foreground">{valueLabel}</p>
      </div>
      <div className="relative">
        <div
          ref={holder}
          className="w-full bg-muted/30"
          style={{ height }}
          aria-label={`Carte de la répartition géographique par ${valueLabel}`}
          role="img"
        />
        {!ready && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Chargement de la carte...
          </p>
        )}
      </div>
      <ul className="grid gap-x-6 gap-y-1 px-4 py-3 text-xs sm:grid-cols-2">
        {top.map((point) => (
          <li key={point.label} className="flex items-center justify-between gap-3">
            <span className="truncate">{point.label}</span>
            <span className="font-semibold tabular-nums">{formatValue(point.value)}</span>
          </li>
        ))}
      </ul>
      {caption && <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">{caption}</p>}
    </div>
  );
}

export default GeoMap;
