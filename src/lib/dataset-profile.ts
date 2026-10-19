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
}

const MAX_TRACKED_UNIQUE = 50_000;
const MAX_MEDIAN_VALUES = 200_000;
const MAX_TOP_KEYS = 20_000;
const MAX_DUPLICATE_TRACKED = 200_000;
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
