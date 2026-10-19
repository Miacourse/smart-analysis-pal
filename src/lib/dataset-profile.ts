import Papa from "papaparse";

export type ColumnType = "number" | "date" | "boolean" | "text" | "empty";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  nonNull: number;
  nulls: number;
  unique: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  sum?: number;
  minDate?: string;
  maxDate?: string;
  top?: { value: string; count: number }[];
}

export interface DatasetProfile {
  version: 1;
  fileName: string;
  rows: number;
  columns: number;
  nullCells: number;
  duplicateRows: number;
  columnProfiles: ColumnProfile[];
  sampleHeader: string[];
  sampleRows: string[][];
  histograms?: ColumnHistogram[];
  correlations?: CorrelationCell[];
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

export interface ColumnHistogram {
  name: string;
  bins: HistogramBin[];
}

export interface CorrelationCell {
  a: string;
  b: string;
  r: number;
}

const MAX_TRACKED_UNIQUE = 50_000;
const MAX_MEDIAN_VALUES = 200_000;
const MAX_TOP_KEYS = 20_000;
const MAX_DUPLICATE_TRACKED = 200_000;
const MAX_CHART_COLUMNS = 8;
const MAX_CHART_ROWS = 50_000;
const HISTOGRAM_BINS = 20;
export const SAMPLE_ROW_COUNT = 40;

export function parseNumeric(raw: string): number | null {
  let s = raw.trim().replace(/[\s\u00a0\u202f]/g, "").replace(/%$/, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  if (!/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function looksLikeDate(raw: string): boolean {
  const s = raw.trim();
  if (!s || /^[-+]?\d+(?:[.,]\d+)?$/.test(s)) return false;
  if (!/[-/:]/.test(s) && !/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|d[ée]c)\b/i.test(s)) {
    return false;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return false;
  const year = new Date(t).getFullYear();
  return year >= 1900 && year <= 2100;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function profileDataset(input: string[][], fileName: string): DatasetProfile {
  const headerCells = input[0] ?? [];
  const columns = headerCells.length;
  const header = headerCells.map((h, i) => String(h ?? "").trim() || `Colonne ${i + 1}`);

  const data = input
    .slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));

  const columnProfiles: ColumnProfile[] = [];
  let nullCells = 0;

  for (let c = 0; c < columns; c++) {
    const name = header[c] ?? `Colonne ${c + 1}`;
    let nonNull = 0;
    let nulls = 0;
    let numberCount = 0;
    let dateCount = 0;
    let booleanCount = 0;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSq = 0;
    let numericCount = 0;
    let minDate: number | null = null;
    let maxDate: number | null = null;

    const unique = new Set<string>();
    let uniqueOverflow = false;
    const top = new Map<string, number>();
    const numericValues: number[] = [];

    for (const row of data) {
      const raw = String(row[c] ?? "").trim();
      if (!raw) {
        nulls++;
        continue;
      }
      nonNull++;

      if (!uniqueOverflow) {
        if (unique.size < MAX_TRACKED_UNIQUE) unique.add(raw);
        else uniqueOverflow = true;
      }
      if (top.size < MAX_TOP_KEYS || top.has(raw)) top.set(raw, (top.get(raw) ?? 0) + 1);

      const num = parseNumeric(raw);
      if (num !== null) {
        numberCount++;
        numericCount++;
        min = Math.min(min, num);
        max = Math.max(max, num);
        sum += num;
        sumSq += num * num;
        if (numericValues.length < MAX_MEDIAN_VALUES) numericValues.push(num);
      }

      if (looksLikeDate(raw)) {
        dateCount++;
        const t = Date.parse(raw);
        if (minDate === null || t < minDate) minDate = t;
        if (maxDate === null || t > maxDate) maxDate = t;
      }

      const lower = raw.toLowerCase();
      if (["true", "false", "oui", "non", "yes", "no", "vrai", "faux"].includes(lower)) booleanCount++;
    }

    nullCells += nulls;

    const ratio = (n: number) => (nonNull > 0 ? n / nonNull : 0);
    let type: ColumnType = "text";
    if (nonNull === 0) type = "empty";
    else if (ratio(numberCount) >= 0.8) type = "number";
    else if (ratio(booleanCount) >= 0.9 && unique.size <= 2) type = "boolean";
    else if (ratio(dateCount) >= 0.8) type = "date";

    const profile: ColumnProfile = {
      name,
      type,
      nonNull,
      nulls,
      unique: uniqueOverflow ? MAX_TRACKED_UNIQUE : unique.size,
    };

    if (type === "number" && numericCount > 0) {
      const mean = sum / numericCount;
      const variance = Math.max(0, sumSq / numericCount - mean * mean);
      profile.min = min;
      profile.max = max;
      profile.mean = mean;
      profile.sum = sum;
      profile.std = Math.sqrt(variance);
      const med = median(numericValues);
      if (med !== undefined) profile.median = med;
    }

    if (type === "date" && minDate !== null && maxDate !== null) {
      profile.minDate = new Date(minDate).toISOString().slice(0, 10);
      profile.maxDate = new Date(maxDate).toISOString().slice(0, 10);
    }

    if (type === "text" || type === "boolean" || unique.size <= 50) {
      profile.top = [...top.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }));
    }

    columnProfiles.push(profile);
  }

  let duplicateRows = 0;
  const seen = new Set<string>();
  for (const row of data) {
    const key = row.join("\u0001");
    if (seen.has(key)) {
      duplicateRows++;
    } else if (seen.size < MAX_DUPLICATE_TRACKED) {
      seen.add(key);
    }
  }

  const chartColumns = columnProfiles
    .map((column, index) => ({ column, index }))
    .filter(
      (entry): entry is { column: ColumnProfile; index: number } =>
        entry.column.type === "number" &&
        entry.column.min !== undefined &&
        entry.column.max !== undefined,
    )
    .slice(0, MAX_CHART_COLUMNS);

  let histograms: ColumnHistogram[] | undefined;
  let correlations: CorrelationCell[] | undefined;
  if (chartColumns.length > 0) {
    const bins = chartColumns.map(({ column }) => {
      const min = column.min ?? 0;
      const max = column.max ?? min;
      const width = max > min ? (max - min) / HISTOGRAM_BINS : 1;
      return Array.from({ length: HISTOGRAM_BINS }, (_, i) => ({
        from: min + i * width,
        to: i === HISTOGRAM_BINS - 1 ? max : min + (i + 1) * width,
        count: 0,
      }));
    });
    const pairs: { i: number; j: number }[] = [];
    for (let i = 0; i < chartColumns.length; i++) {
      for (let j = i + 1; j < chartColumns.length; j++) pairs.push({ i, j });
    }
    const stats = pairs.map(() => ({ n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0 }));
    const maxRows = Math.min(data.length, MAX_CHART_ROWS);
    for (let r = 0; r < maxRows; r++) {
      const row = data[r] ?? [];
      const values = chartColumns.map(({ index }) => parseNumeric(String(row[index] ?? "").trim()));
      values.forEach((value, k) => {
        if (value === null) return;
        const column = chartColumns[k]?.column;
        const columnBins = bins[k];
        if (!column || !columnBins) return;
        const min = column.min ?? 0;
        const max = column.max ?? min;
        const width = max > min ? (max - min) / HISTOGRAM_BINS : 1;
        let binIndex = Math.floor((value - min) / width);
        if (binIndex < 0) binIndex = 0;
        if (binIndex >= HISTOGRAM_BINS) binIndex = HISTOGRAM_BINS - 1;
        const bin = columnBins[binIndex];
        if (bin) bin.count++;
      });
      pairs.forEach((pair, p) => {
        const x = values[pair.i];
        const y = values[pair.j];
        const entry = stats[p];
        if (x === null || x === undefined || y === null || y === undefined || !entry) return;
        entry.n++;
        entry.sx += x;
        entry.sy += y;
        entry.sxx += x * x;
        entry.syy += y * y;
        entry.sxy += x * y;
      });
    }
    histograms = chartColumns.map(({ column }, k) => ({
      name: column.name,
      bins: bins[k] ?? [],
    }));
    correlations = pairs.map((pair, p) => {
      const entry = stats[p]!;
      const denominator = Math.sqrt(
        (entry.n * entry.sxx - entry.sx * entry.sx) * (entry.n * entry.syy - entry.sy * entry.sy),
      );
      const r = denominator > 0 ? (entry.n * entry.sxy - entry.sx * entry.sy) / denominator : 0;
      return {
        a: chartColumns[pair.i]?.column.name ?? "",
        b: chartColumns[pair.j]?.column.name ?? "",
        r: Math.max(-1, Math.min(1, r)),
      };
    });
  }

  const sampleRows: string[][] = [];
  if (data.length > 0) {
    const step = Math.max(1, Math.floor(data.length / SAMPLE_ROW_COUNT));
    for (let i = 0; i < data.length && sampleRows.length < SAMPLE_ROW_COUNT; i += step) {
      sampleRows.push(data[i] ?? []);
    }
  }

  return {
    version: 1,
    fileName,
    rows: data.length,
    columns,
    nullCells,
    duplicateRows,
    columnProfiles,
    sampleHeader: header,
    sampleRows,
    ...(histograms ? { histograms } : {}),
    ...(correlations ? { correlations } : {}),
  };
}

function formatNumber(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function csvEscapeRow(row: string[]): string {
  return row
    .map((cell) => {
      const value = String(cell ?? "");
      return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    })
    .join(",");
}

export function formatProfileForPrompt(profile: DatasetProfile, maxChars = 24_000): string {
  const lines: string[] = [];
  lines.push(`Fichier: ${profile.fileName}`);
  lines.push(
    `Dimensions: ${profile.rows} lignes × ${profile.columns} colonnes` +
      (profile.duplicateRows > 0 ? ` (${profile.duplicateRows} doublons détectés)` : ""),
  );
  lines.push(`Cellules vides: ${profile.nullCells}`);
  lines.push("");
  lines.push("Profil statistique calculé sur l'intégralité du fichier:");
  for (const column of profile.columnProfiles) {
    const parts = [
      `- "${column.name}" [${column.type}]`,
      `non-nul=${column.nonNull}`,
      `vides=${column.nulls}`,
      `uniques=${column.unique}`,
    ];
    if (column.type === "number") {
      parts.push(
        `min=${formatNumber(column.min)}`,
        `max=${formatNumber(column.max)}`,
        `moyenne=${formatNumber(column.mean)}`,
        `médiane=${formatNumber(column.median)}`,
        `écart-type=${formatNumber(column.std)}`,
        `somme=${formatNumber(column.sum)}`,
      );
    }
    if (column.type === "date") {
      parts.push(`du ${column.minDate ?? "?"} au ${column.maxDate ?? "?"}`);
    }
    if (column.top && column.top.length > 0) {
      parts.push(`top=${column.top.map((t) => `${t.value} (${t.count})`).join(", ")}`);
    }
    lines.push(parts.join(" | "));
  }

  if (profile.sampleRows.length > 0) {
    lines.push("");
    lines.push(
      `Échantillon de ${profile.sampleRows.length} lignes réparties sur tout le fichier (CSV):`,
    );
    lines.push(csvEscapeRow(profile.sampleHeader));
    for (const row of profile.sampleRows) lines.push(csvEscapeRow(row));
  }

  const output = lines.join("\n");
  if (output.length <= maxChars) return output;
  return `${output.slice(0, maxChars)}\n…(profil tronqué)`;
}

export function profileSummary(profile: DatasetProfile): string {
  return `${profile.rows} ligne${profile.rows > 1 ? "s" : ""} × ${profile.columns} colonne${
    profile.columns > 1 ? "s" : ""
  }`;
}

export function parseCsvFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (rows: string[][]) => {
      if (settled) return;
      settled = true;
      resolve(rows);
    };
    const fallback = () => {
      if (settled) return;
      void file
        .text()
        .then((text) => {
          const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
          finish(
            (result.data as unknown as string[][]).map((row) =>
              row.map((cell) => String(cell ?? "")),
            ),
          );
        })
        .catch((error: unknown) => {
          if (settled) return;
          settled = true;
          reject(error);
        });
    };
    try {
      Papa.parse<string[]>(file, {
        skipEmptyLines: "greedy",
        worker: true,
        complete: (results) => {
          finish(
            (results.data as unknown as string[][]).map((row) =>
              row.map((cell) => String(cell ?? "")),
            ),
          );
        },
        error: () => fallback(),
      });
    } catch {
      fallback();
    }
  });
}

export async function parseExcelFile(file: File): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  }) as unknown[][];
  return rows.map((row) => row.map((cell) => String(cell ?? "")));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function featureCoordinates(feature: Record<string, unknown>): [number, number] | null {
  const geometry = isRecord(feature["geometry"]) ? feature["geometry"] : null;
  const coordinates = geometry?.["coordinates"];
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [lon, lat] = coordinates;
  return typeof lon === "number" && typeof lat === "number" ? [lon, lat] : null;
}

export function jsonToRows(value: unknown): string[][] {
  let candidate: unknown = value;
  if (isRecord(value) && Array.isArray(value["features"])) {
    candidate = value["features"];
  } else if (isRecord(value)) {
    const nested = Object.values(value).find(
      (entry) => Array.isArray(entry) && entry.some((item) => isRecord(item)),
    );
    if (nested) candidate = nested;
  }

  let items: unknown[];
  if (Array.isArray(candidate)) items = candidate;
  else if (isRecord(candidate)) items = [candidate];
  else return [];

  if (items.every((item) => Array.isArray(item))) {
    return (items as unknown[][]).map((row) => row.map((cell) => String(cell ?? "")));
  }
  const objects = items.filter(isRecord);
  if (objects.length === 0) return [];

  const isFeatureCollection = isRecord(value) && Array.isArray(value["features"]);
  const keys: string[] = [];
  for (const object of objects) {
    const source = isFeatureCollection && isRecord(object["properties"]) ? object["properties"] : object;
    for (const key of Object.keys(source)) {
      if (!keys.includes(key) && keys.length < 500) keys.push(key);
    }
  }
  if (isFeatureCollection) {
    if (!keys.includes("longitude")) keys.push("longitude");
    if (!keys.includes("latitude")) keys.push("latitude");
  }

  const rows = objects.map((object) => {
    const source = isFeatureCollection && isRecord(object["properties"]) ? object["properties"] : object;
    const coordinates = isFeatureCollection ? featureCoordinates(object) : null;
    return keys.map((key) => {
      if (key === "longitude") return coordinates ? String(coordinates[0]) : "";
      if (key === "latitude") return coordinates ? String(coordinates[1]) : "";
      const cell = source[key];
      if (cell === null || cell === undefined) return "";
      return typeof cell === "object" ? JSON.stringify(cell) : String(cell);
    });
  });
  return [keys, ...rows];
}

export async function parseJsonFile(file: File): Promise<string[][]> {
  return jsonToRows(JSON.parse(await file.text()));
}

export function lasToRows(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  let curveNames: string[] = [];
  let inCurves = false;
  let dataStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (/^~C/i.test(line)) {
      inCurves = true;
      continue;
    }
    if (/^~A/i.test(line)) {
      dataStart = i + 1;
      break;
    }
    if (line.startsWith("~")) {
      inCurves = false;
      continue;
    }
    if (inCurves && line) {
      const match = line.match(/^([^.\s:]+)/);
      if (match?.[1]) curveNames.push(match[1].toUpperCase());
    }
  }

  if (dataStart < 0) return [];
  const rows: string[][] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line || line.startsWith("#")) continue;
    rows.push(line.split(/\s+/));
  }
  if (rows.length === 0) return [];

  const width = Math.max(...rows.map((row) => row.length));
  if (curveNames.length !== width) {
    curveNames = Array.from({ length: width }, (_, index) =>
      index === 0 ? "DEPT" : `CURVE_${index + 1}`,
    );
  }
  return [curveNames, ...rows];
}

export async function parseLasFile(file: File): Promise<string[][]> {
  return lasToRows(await file.text());
}
