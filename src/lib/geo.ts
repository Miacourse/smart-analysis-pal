export type GeoPoint = {
  label: string;
  lat: number;
  lng: number;
  value: number;
};

type Country = [iso: string, lat: number, lng: number, ...names: string[]];

const COUNTRIES: Country[] = [
  ["FR", 46.6, 2.4, "france"],
  ["US", 39.8, -98.6, "etats-unis", "etats unis", "united states", "usa", "amerique"],
  ["CA", 56.1, -106.3, "canada"],
  ["GB", 54.0, -2.0, "royaume-uni", "united kingdom", "uk", "grande-bretagne", "angleterre"],
  ["DE", 51.2, 10.4, "allemagne", "germany", "deutschland"],
  ["ES", 40.5, -3.7, "espagne", "spain", "espana"],
  ["IT", 41.9, 12.6, "italie", "italy", "italia"],
  ["BE", 50.5, 4.5, "belgique", "belgium", "belgique"],
  ["NL", 52.1, 5.3, "pays-bas", "netherlands", "holland", "nederland"],
  ["CH", 46.8, 8.2, "suisse", "switzerland", "schweiz", "svizzera"],
  ["LU", 49.8, 6.1, "luxembourg"],
  ["PT", 39.4, -8.2, "portugal"],
  ["IE", 53.1, -8.2, "irlande", "ireland"],
  ["AT", 47.6, 14.1, "autriche", "austria"],
  ["DK", 56.0, 10.0, "danemark", "denmark"],
  ["SE", 62.0, 15.0, "suede", "sweden"],
  ["NO", 60.5, 8.5, "norvege", "norway"],
  ["FI", 64.0, 26.0, "finlande", "finland"],
  ["PL", 52.2, 19.4, "pologne", "poland", "polska"],
  ["CZ", 49.8, 15.5, "tchequie", "czechia", "czech republic"],
  ["SK", 48.7, 19.7, "slovaquie", "slovakia"],
  ["HU", 47.2, 19.5, "hongrie", "hungary"],
  ["RO", 45.9, 25.0, "roumanie", "romania"],
  ["BG", 42.7, 25.5, "bulgarie", "bulgaria"],
  ["GR", 39.1, 21.8, "grece", "greece"],
  ["HR", 45.1, 15.2, "croatie", "croatia"],
  ["SI", 46.2, 15.0, "slovenie", "slovenia"],
  ["RS", 44.0, 21.0, "serbie", "serbia"],
  ["UA", 48.4, 31.2, "ukraine"],
  ["RU", 61.5, 105.0, "russie", "russia"],
  ["TR", 39.0, 35.2, "turquie", "turkey", "turkiye"],
  ["MA", 31.8, -7.1, "maroc", "morocco"],
  ["DZ", 28.0, 1.7, "algerie", "algeria"],
  ["TN", 33.9, 9.5, "tunisie", "tunisia"],
  ["EG", 26.8, 30.8, "egypte", "egypt"],
  ["SN", 14.5, -14.5, "senegal"],
  ["CI", 7.5, -5.5, "cote d'ivoire", "cote divoire", "ivory coast"],
  ["CM", 7.4, 12.4, "cameroun", "cameroon"],
  ["NG", 9.1, 8.7, "nigeria"],
  ["GH", 7.9, -1.0, "ghana"],
  ["KE", -0.0, 37.9, "kenya"],
  ["ZA", -30.6, 22.9, "afrique du sud", "south africa"],
  ["ET", 9.1, 40.5, "ethiopie", "ethiopia"],
  ["IL", 31.0, 34.9, "israel"],
  ["SA", 23.9, 45.1, "arabie saoudite", "saudi arabia"],
  ["AE", 23.4, 53.8, "emirats arabes unis", "uae", "united arab emirates"],
  ["QA", 25.3, 51.2, "qatar"],
  ["IN", 20.6, 79.0, "inde", "india"],
  ["PK", 30.4, 69.3, "pakistan"],
  ["BD", 23.7, 90.4, "bangladesh"],
  ["CN", 35.9, 104.2, "chine", "china"],
  ["JP", 36.2, 138.3, "japon", "japan"],
  ["KR", 35.9, 127.8, "coree du sud", "south korea", "korea"],
  ["ID", -0.8, 113.9, "indonesie", "indonesia"],
  ["VN", 14.1, 108.3, "vietnam"],
  ["TH", 15.9, 101.0, "thailande", "thailand"],
  ["MY", 4.2, 101.98, "malaisie", "malaysia"],
  ["SG", 1.35, 103.8, "singapour", "singapore"],
  ["PH", 12.9, 121.8, "philippines"],
  ["AU", -25.3, 133.8, "australie", "australia"],
  ["NZ", -40.9, 174.9, "nouvelle-zelande", "new zealand"],
  ["BR", -14.2, -51.9, "bresil", "brazil", "brasil"],
  ["AR", -38.4, -63.6, "argentine", "argentina"],
  ["MX", 23.6, -102.6, "mexique", "mexico"],
  ["CL", -35.7, -71.5, "chili", "chile"],
  ["CO", 4.6, -74.3, "colombie", "colombia"],
  ["PE", -9.2, -75.0, "perou", "peru"],
  ["UY", -32.5, -55.8, "uruguay"],
];

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

const BY_ALIAS = new Map<string, { iso: string; lat: number; lng: number }>();
for (const [iso, lat, lng, ...names] of COUNTRIES) {
  BY_ALIAS.set(iso.toLowerCase(), { iso, lat, lng });
  for (const name of names) BY_ALIAS.set(normalize(name), { iso, lat, lng });
}

export function resolveCountry(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const direct = BY_ALIAS.get(raw.toLowerCase());
  if (direct) return direct;
  const normalized = normalize(raw);
  const exact = BY_ALIAS.get(normalized);
  if (exact) return exact;
  for (const [alias, point] of BY_ALIAS) {
    if (alias.length < 4) continue;
    if (normalized.startsWith(alias) || alias.startsWith(normalized)) return point;
  }
  return null;
}

const DISPLAY: Record<string, string> = {
  US: "États-Unis",
  GB: "Royaume-Uni",
  CI: "Côte d'Ivoire",
  KR: "Corée du Sud",
  NZ: "Nouvelle-Zélande",
  GR: "Grèce",
  SE: "Suède",
  NO: "Norvège",
  CZ: "Tchéquie",
  DZ: "Algérie",
  EG: "Égypte",
  SN: "Sénégal",
  TH: "Thaïlande",
  ID: "Indonésie",
  BR: "Brésil",
  PE: "Pérou",
  AE: "Émirats arabes unis",
  ET: "Éthiopie",
  NL: "Pays-Bas",
  RU: "Russie",
};

export function countryName(iso: string) {
  if (DISPLAY[iso]) return DISPLAY[iso];
  for (const [code, , , ...names] of COUNTRIES) {
    if (code === iso) {
      const name = names[0] ?? code;
      return name.replace(/(^|[\s-])([\p{L}])/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
    }
  }
  return iso;
}

const stripNumber = (value: string) => {
  const cleaned = value.replace(/[\s\u00a0]/g, "").replace(/[€$£%]/g, "").replace(",", ".");
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
