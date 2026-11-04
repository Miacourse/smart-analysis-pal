import { WORLD_COUNTRIES } from "./countries-data";

export type GeoPoint = {
  label: string;
  lat: number;
  lng: number;
  value: number;
};

const GEO_HEADER =
  /(^|\b)(pays|country|countries|régions?|regions?|nation|localisation|localisation|location|geo|zone|marché|market|territoire)(\b|$)/i;

const VALUE_HEADER =
  /(sessions?|visites?|visiteurs?|visitors?|utilisateurs?|users?|trafic|traffic|clics?|clicks?|hits?|pageviews?|vues?|événements?|events?|conversions?|commandes?|orders?|revenu|revenue|ca\b|chiffre)/i;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const EXTRA_ALIASES: Record<string, string> = {
  usa: "US",
  uk: "GB",
  uae: "AE",
  rdc: "CD",
  zaire: "CD",
  "rd congo": "CD",
  "congo kinshasa": "CD",
  "democratic republic of the congo": "CD",
  "republique democratique du congo": "CD",
  "republic of the congo": "CG",
  "congo brazzaville": "CG",
  "republique du congo": "CG",
  turkey: "TR",
  "cape verde": "CV",
  swaziland: "SZ",
  burma: "MM",
  "czech republic": "CZ",
  holland: "NL",
  hollande: "NL",
  "ivory coast": "CI",
  "russian federation": "RU",
  "bolivia plurinational state of": "BO",
  "venezuela bolivarian republic of": "VE",
  "viet nam": "VN",
  "iran islamic republic of": "IR",
  "syrian arab republic": "SY",
  "tanzania united republic of": "TZ",
  "united states of america": "US",
  "south korea": "KR",
  "north korea": "KP",
  "bosnia and herzegovina": "BA",
  "north macedonia": "MK",
};

const BY_ALIAS = new Map<string, { iso: string; lat: number; lng: number }>();
for (const country of WORLD_COUNTRIES) {
  const point = { iso: country.iso, lat: country.lat, lng: country.lng };
  BY_ALIAS.set(country.iso.toLowerCase(), point);
  BY_ALIAS.set(normalize(country.en), point);
  BY_ALIAS.set(normalize(country.fr), point);
}
for (const [alias, iso] of Object.entries(EXTRA_ALIASES)) {
  const target = BY_ALIAS.get(iso.toLowerCase());
  if (target) BY_ALIAS.set(alias, target);
}

export function resolveCountry(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const direct = BY_ALIAS.get(raw.toLowerCase());
  if (direct) return direct;
  const normalized = normalize(raw);
  if (normalized.length < 2) return null;
  const exact = BY_ALIAS.get(normalized);
  if (exact) return exact;
  for (const [alias, point] of BY_ALIAS) {
    if (alias.length < 4 || normalized.length < 4) continue;
    if (normalized.startsWith(alias) || alias.startsWith(normalized)) return point;
  }
  return null;
}

const BY_ISO = new Map(WORLD_COUNTRIES.map((country) => [country.iso, country]));

export function countryName(iso: string) {
  const code = iso.trim().toUpperCase();
  const match = BY_ISO.get(code);
  if (match) return match.fr;
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      const localized = new Intl.DisplayNames(["fr"], { type: "region" }).of(code);
      if (localized && localized !== code) return localized;
    } catch {
      // Code pays inconnu : conserver le libellé d'origine.
    }
  }
  return iso;
}

const stripNumber = (value: string) => {
  const cleaned = value
    .replace(/[\s\u00a0]/g, "")
    .replace(/[€$£%]/g, "")
    .replace(",", ".");
  return cleaned === "" ? Number.NaN : Number(cleaned);
};

export function parseDelimited(text: string): string[][] {
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
    else if (ch === "," || ch === ";") {
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

export type GeoTraffic = {
  labelColumn: string;
  valueColumn: string;
  points: GeoPoint[];
  rows: Array<{ label: string; value: number; share: number }>;
};

export function geoTrafficFromPreview(preview: string | null | undefined): GeoTraffic | null {
  if (!preview || !preview.trim()) return null;
  const parsed = parseDelimited(preview);
  if (parsed.length < 3) return null;
  const header = (parsed[0] ?? []).map((name) => name.trim());
  const body = parsed.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (body.length < 2) return null;

  const geoIndex = header.findIndex((name) => GEO_HEADER.test(name));
  if (geoIndex < 0) return null;

  const numericIndexes = header
    .map((name, index) => ({ name, index }))
    .filter(({ name, index }) => {
      if (index === geoIndex) return false;
      const values = body.map((row) => (row[index] ?? "").trim()).filter(Boolean);
      if (values.length === 0) return false;
      const numbers = values.filter((value) => Number.isFinite(stripNumber(value))).length;
      return numbers / values.length >= 0.7;
    });

  const preferred =
    numericIndexes.find(({ name }) => VALUE_HEADER.test(name)) ?? numericIndexes[0] ?? null;
  const valueIndex = preferred?.index ?? -1;

  const buckets = new Map<string, { label: string; value: number }>();
  for (const row of body) {
    const label = (row[geoIndex] ?? "").trim();
    if (!label) continue;
    const value = valueIndex >= 0 ? stripNumber(row[valueIndex] ?? "") : 1;
    if (!Number.isFinite(value)) continue;
    const key = normalize(label);
    const current = buckets.get(key) ?? { label, value: 0 };
    current.value += value;
    buckets.set(key, current);
  }
  if (buckets.size < 2) return null;

  const rows = [...buckets.values()].sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, row) => sum + Math.abs(row.value), 0) || 1;
  const byCountry = new Map<string, GeoPoint>();
  for (const row of rows) {
    const country = resolveCountry(row.label);
    if (!country) continue;
    const existing = byCountry.get(country.iso);
    if (existing) existing.value += row.value;
    else
      byCountry.set(country.iso, {
        label: countryName(country.iso),
        lat: country.lat,
        lng: country.lng,
        value: row.value,
      });
  }
  const points = [...byCountry.values()];
  if (points.length < 2) return null;

  return {
    labelColumn: header[geoIndex] ?? "Pays",
    valueColumn: preferred?.name ?? "Volume",
    points: points.sort((a, b) => b.value - a.value).slice(0, 30),
    rows: rows.slice(0, 12).map((row) => ({
      label: countryName(resolveCountry(row.label)?.iso ?? "") || row.label,
      value: row.value,
      share: Math.abs(row.value) / total,
    })),
  };
}
