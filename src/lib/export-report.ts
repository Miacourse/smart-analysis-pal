import type { UIMessage } from "ai";

import { stripChartBlocks } from "@/lib/chart-spec";
import { geoTrafficFromPreview } from "@/lib/geo";

type ReportInput = {
  title: string;
  datasetName: string | null;
  datasetPreview: string | null;
  messages: UIMessage[];
};

const INK = [17, 24, 39] as const;
const MUTED = [107, 114, 128] as const;
const ACCENT = [15, 118, 110] as const;
const BORDER = [226, 232, 240] as const;
const SURFACE = [249, 250, 251] as const;
const HEADER_FILL = [31, 41, 55] as const;

function messageText(m: UIMessage) {
  return stripChartBlocks(
    m.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .filter(Boolean)
      .join("\n"),
  );
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function stripLatex(input: string): string {
  let s = input.replace(/\$\$?([\s\S]*?)\$\$?/g, "$1");
  s = s.replace(/\\text\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\mathrm\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1) / ($2)");
  s = s.replace(/\\times/g, "x");
  s = s.replace(/\\approx/g, "environ");
  s = s.replace(/\\leq/g, "<=").replace(/\\geq/g, ">=");
  s = s.replace(/\\%/g, "%");
  s = s.replace(/\\[,;:!]/g, " ");
  s = s.replace(/\\[a-zA-Z]+/g, " ");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\\/g, "");
  return s;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "-",
  ndash: "-",
  hellip: "...",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  rarr: "->",
  rightarrow: "->",
  larr: "<-",
  leftarrow: "<-",
  ge: ">=",
  le: "<=",
  times: "x",
  euro: "EUR",
  percnt: "%",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (/^#x/i.test(code)) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return HTML_ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function sanitizeReportText(input: string): string {
  let s = decodeEntities(stripLatex(input.normalize("NFC")));
  s = s.replace(
    /<\/?(?:br|p|div|span|strong|em|b|i|u|ul|ol|li|h[1-6]|table|thead|tbody|tr|td|th|code|pre|sup|sub|a|blockquote)\b[^>]*\/?>/gi,
    " ",
  );
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/[\u00A0\u2007\u202F]/g, " ");
  s = s.replace(/\u2026/g, "...");
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'");
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');
  s = s.replace(/\s+[\u2014\u2013]\s+/g, " - ");
  s = s.replace(/[\u2014\u2013]/g, "-");
  s = s.replace(/\u2192/g, " -> ").replace(/\u2190/g, " <- ");
  s = s.replace(/\u2248/g, "environ ");
  s = s.replace(/\u2264/g, "<=").replace(/\u2265/g, ">=").replace(/\u2260/g, "!=");
  s = s.replace(/€/g, "EUR");
  s = s.replace(/[\uFE0E\uFE0F]/g, "");
  s = s.replace(EMOJI_RE, "");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/\s+([.,])/g, "$1");
  s = s.replace(/ *\n */g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function stripMd(s: string) {
  return s
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

export function reportTitle(input: Pick<ReportInput, "title" | "datasetName">) {
  if (input.datasetName) {
    const name = input.datasetName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    if (name) {
      return `Analyse de ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    }
  }
  return input.title || "Analyse de données";
}

function fileBase(input: ReportInput) {
  const d = new Date().toISOString().slice(0, 10);
  const base = (input.datasetName ?? input.title ?? "analyse").replace(/\.[^.]+$/, "");
  return `rapport-${base.replace(/[^\w-]+/g, "_")}-${d}`;
}

function sanitizeCell(value: string) {
  return sanitizeReportText(stripMd(value).replace(/\s+/g, " "));
}

export function extractMarkdownTables(md: string): string[][][] {
  const tables: string[][][] = [];
  const lines = md.split("\n");
  let cur: string[][] = [];
  const flush = () => {
    if (cur.length > 1) tables.push(cur);
    cur = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim().replace(/\*\*/g, ""));
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      cur.push(cells);
    } else flush();
  }
  flush();
  return tables;
}

function isTableLine(line: string) {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|");
}

function isSeparatorRow(cells: string[]) {
  return cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim().replace(/\*\*/g, ""));
}

export function splitReportBlocks(
  md: string,
): Array<{ type: "text"; text: string } | { type: "table"; rows: string[][] }> {
  const blocks: Array<{ type: "text"; text: string } | { type: "table"; rows: string[][] }> = [];
  let textBuf: string[] = [];
  let tableBuf: string[][] = [];
  const flushText = () => {
    if (textBuf.length) {
      blocks.push({ type: "text", text: textBuf.join("\n") });
      textBuf = [];
    }
  };
  const flushTable = () => {
    if (tableBuf.length) {
      const rows = tableBuf.filter((r) => !isSeparatorRow(r));
      if (rows.length) blocks.push({ type: "table", rows });
      tableBuf = [];
    }
  };
  for (const line of md.split("\n")) {
    if (isTableLine(line)) {
      flushText();
      tableBuf.push(parseTableRow(line));
    } else {
      flushTable();
      textBuf.push(line);
    }
  }
  flushText();
  flushTable();
  return blocks;
}

type ReportDoc = import("jspdf").jsPDF;

const PAGE_MARGIN_X = 56;
const PAGE_TOP = 64;
const PAGE_BOTTOM = 64;

function buildPdf(doc: ReportDoc, input: ReportInput) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = PAGE_MARGIN_X;
  const contentW = W - 2 * M;
  const bottom = H - PAGE_BOTTOM;
  let y = PAGE_TOP;

  const setInk = () => doc.setTextColor(INK[0], INK[1], INK[2]);
  const setMuted = () => doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const setAccent = () => doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  const setBorder = () => doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);

  const newPage = () => {
    doc.addPage();
    y = PAGE_TOP;
  };

  const ensure = (height: number) => {
    if (y + height > bottom) newPage();
  };

  const justify = (line: string, x: number, width: number) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 3) {
      doc.text(line, x, y);
      return;
    }
    const extra = width - doc.getTextWidth(line);
    const gap = extra / (words.length - 1);
    if (gap <= 0 || gap > 2.4) {
      doc.text(line, x, y);
      return;
    }
    const space = doc.getTextWidth(" ");
    let cx = x;
    for (const word of words) {
      doc.text(word, cx, y);
      cx += doc.getTextWidth(word) + space + gap;
    }
  };

  const renderParagraph = (text: string) => {
    const clean = sanitizeReportText(stripMd(text)).replace(/^\s*>\s?/gm, "");
    if (!clean) return;
    doc.setFont("helvetica", "normal").setFontSize(10);
    setInk();
    const lines = doc.splitTextToSize(clean, contentW) as string[];
    lines.forEach((line, index) => {
      ensure(14.5);
      if (index < lines.length - 1) justify(line, M, contentW);
      else doc.text(line, M, y);
      y += 14.5;
    });
    y += 6;
  };

  const renderHeading = (level: number, text: string) => {
    const clean = sanitizeReportText(stripMd(text));
    if (!clean) return;
    const size = level <= 1 ? 14.5 : level === 2 ? 12 : 11;
    ensure(size + 26);
    y += level <= 1 ? 12 : 9;
    doc.setFont("helvetica", "bold").setFontSize(size);
    if (level <= 2) setAccent();
    else setInk();
    doc.text(clean, M, y);
    if (level <= 1) {
      y += 5;
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(1.1);
      doc.line(M, y, M + 38, y);
      doc.setLineWidth(0.5);
      y += 9;
    } else {
      y += 8;
    }
    y += size * 0.35;
  };

  const renderListItem = (text: string, label: string | null) => {
    const clean = sanitizeReportText(stripMd(text));
    if (!clean) return;
    const indent = label ? 20 : 14;
    doc.setFont("helvetica", "normal").setFontSize(10);
    const lines = doc.splitTextToSize(clean, contentW - indent) as string[];
    ensure(lines.length * 13.5 + 4);
    if (label) {
      doc.setFont("helvetica", "bold").setFontSize(9.5);
      setAccent();
      doc.text(label, M, y);
    } else {
      setAccent();
      doc.text("•", M + 2, y);
    }
    doc.setFont("helvetica", "normal").setFontSize(10);
    setInk();
    lines.forEach((line) => {
      doc.text(line, M + indent, y);
      y += 13.5;
    });
    y += 3;
  };

  const renderRule = () => {
    ensure(12);
    y += 4;
    setBorder();
    doc.setLineWidth(0.6);
    doc.line(M, y, W - M, y);
    doc.setLineWidth(0.4);
    y += 10;
  };

  const renderTable = (rows: string[][]) => {
    if (rows.length === 0) return;
    const cols = Math.max(...rows.map((r) => r.length));
    const cleaned = rows.map((r) => Array.from({ length: cols }, (_, c) => sanitizeCell(r[c] ?? "")));
    const maxLen = new Array(cols).fill(8) as number[];
    for (const r of cleaned) {
      for (let c = 0; c < cols; c++) maxLen[c] = Math.max(maxLen[c]!, Math.min(38, r[c]!.length));
    }
    const weightTotal = maxLen.reduce((a, b) => a + b, 0) || 1;

    const pad = 5;
    const lineH = 11.2;

    const minWidthsFor = (fs: number) => {
      doc.setFontSize(fs);
      const mins = new Array(cols).fill(0) as number[];
      for (let ri = 0; ri < cleaned.length; ri++) {
        doc.setFont("helvetica", ri === 0 ? "bold" : "normal");
        for (let c = 0; c < cols; c++) {
          for (const word of cleaned[ri]![c]!.split(/\s+/)) {
            if (word) mins[c] = Math.max(mins[c]!, doc.getTextWidth(word));
          }
        }
      }
      return mins.map((w) => w + 2 * pad + 2);
    };

    let fontSize = 8.8;
    let minWidths = minWidthsFor(fontSize);
    let totalMin = minWidths.reduce((a, b) => a + b, 0);
    while (totalMin > contentW && fontSize > 7) {
      fontSize -= 0.4;
      minWidths = minWidthsFor(fontSize);
      totalMin = minWidths.reduce((a, b) => a + b, 0);
    }

    let colW = maxLen.map((w, i) => Math.max(minWidths[i]!, (w / weightTotal) * contentW));
    const sumW = colW.reduce((a, b) => a + b, 0);
    if (sumW > contentW) {
      const excess = sumW - contentW;
      const slack = colW.map((w, i) => w - minWidths[i]!);
      const slackTotal = slack.reduce((a, b) => a + b, 0) || 1;
      colW = colW.map((w, i) => w - excess * (slack[i]! / slackTotal));
    } else if (sumW < contentW) {
      const extra = contentW - sumW;
      colW = colW.map((w, i) => w + extra * (minWidths[i]! / (totalMin || 1)));
    }
    const finalW = colW.reduce((a, b) => a + b, 0);
    if (finalW > contentW + 0.5) colW = colW.map((w) => (w * contentW) / finalW);

    const header = cleaned[0]!;
    const body = cleaned.slice(1);

    const rowMetrics = (r: string[], bold: boolean) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(fontSize);
      const cellLines = r.map(
        (cell, c) => doc.splitTextToSize(cell, Math.max(12, colW[c]! - 2 * pad)) as string[],
      );
      const lines = Math.max(1, ...cellLines.map((l) => l.length));
      return { cellLines, height: lines * lineH + 2 * pad };
    };

    const totalHeight =
      rowMetrics(header, true).height +
      body.reduce((sum, r) => sum + rowMetrics(r, false).height, 0);
    const usable = bottom - PAGE_TOP;
    if (y + totalHeight > bottom && totalHeight <= usable) {
      newPage();
    }

    const drawRow = (r: string[], bold: boolean, headerRow: boolean, zebra: boolean) => {
      const { cellLines, height } = rowMetrics(r, bold);
      if (y + height > bottom) {
        newPage();
        if (!headerRow) {
          const m = rowMetrics(header, true);
          drawRowBox(header, m.cellLines, m.height, true, false);
        }
      }
      drawRowBox(r, cellLines, height, headerRow, zebra);
    };

    const drawRowBox = (
      r: string[],
      cellLines: string[][],
      height: number,
      headerRow: boolean,
      zebra: boolean,
    ) => {
      const top = y;
      let x = M;
      for (let c = 0; c < cols; c++) {
        if (headerRow) {
          doc.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2]);
          doc.rect(x, top, colW[c]!, height, "F");
        } else if (zebra) {
          doc.setFillColor(SURFACE[0], SURFACE[1], SURFACE[2]);
          doc.rect(x, top, colW[c]!, height, "F");
        }
        setBorder();
        doc.setLineWidth(0.5);
        doc.rect(x, top, colW[c]!, height);
        doc.setFont("helvetica", bold(headerRow)).setFontSize(fontSize);
        if (headerRow) doc.setTextColor(255, 255, 255);
        else setInk();
        const numeric =
          !headerRow &&
          /^[-+]?[\d\s.,%$£]+(?: EUR)?$/.test(r[c]!) &&
          /\d/.test(r[c]!);
        const lines = cellLines[c]!;
        let ty = top + pad + fontSize;
        for (const line of lines) {
          if (numeric) doc.text(line, x + colW[c]! - pad, ty, { align: "right" });
          else doc.text(line, x + pad, ty);
          ty += lineH;
        }
        x += colW[c]!;
      }
      y += height;
    };

    ensure(rowMetrics(header, true).height + 40);
    drawRow(header, true, true, false);
    body.forEach((r, index) => drawRow(r, false, false, index % 2 === 1));
    y += 10;
    doc.setLineWidth(0.4);
  };

  const bold = (value: boolean) => (value ? "bold" : "normal");

  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, W, 6, "F");

  doc.setFont("helvetica", "bold").setFontSize(9);
  setAccent();
  doc.setCharSpace(1.4);
  doc.text("RAPPORT D'ANALYSE", M, PAGE_TOP);
  doc.setCharSpace(0);
  y = PAGE_TOP + 28;

  doc.setFont("helvetica", "bold").setFontSize(19);
  setInk();
  const allTitleLines = doc.splitTextToSize(
    sanitizeReportText(reportTitle(input)),
    contentW,
  ) as string[];
  const titleLines = allTitleLines.slice(0, 3);
  if (allTitleLines.length > titleLines.length && titleLines.length > 0) {
    const last = titleLines.length - 1;
    titleLines[last] = `${titleLines[last]!.replace(/\s+\S*$/, "")}...`;
  }
  for (const line of titleLines) {
    doc.text(line, M, y);
    y += 24;
  }
  y += 8;

  const meta: Array<[string, string]> = [
    ["Fichier", input.datasetName ?? "Aucun fichier"],
    [
      "Date",
      sanitizeReportText(
        new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }),
      ),
    ],
    ["Échanges", `${input.messages.length} message(s)`],
  ];
  const boxH = 20 + meta.length * 16;
  doc.setFillColor(SURFACE[0], SURFACE[1], SURFACE[2]);
  setBorder();
  doc.setLineWidth(0.6);
  doc.roundedRect(M, y, contentW, boxH, 6, 6, "FD");
  let my = y + 19;
  for (const [label, value] of meta) {
    doc.setFont("helvetica", "bold").setFontSize(8.2);
    setMuted();
    doc.text(label.toUpperCase(), M + 14, my);
    doc.setFont("helvetica", "normal").setFontSize(9.4);
    setInk();
    doc.text(value, M + 82, my);
    my += 16;
  }
  y += boxH + 26;
  doc.setLineWidth(0.5);

  input.messages.forEach((m, index) => {
    const md = messageText(m).trim();
    if (!md) return;

    ensure(40);
    if (index > 0) {
      setBorder();
      doc.setLineWidth(0.5);
      doc.line(M, y - 6, W - M, y - 6);
      y += 12;
    }

    doc.setFont("helvetica", "bold").setFontSize(8.6);
    setAccent();
    doc.setCharSpace(1.1);
    doc.text(m.role === "user" ? "QUESTION" : "ANALYSE", M, y);
    doc.setCharSpace(0);
    y += 16;

    if (m.role === "user") {
      doc.setFont("helvetica", "italic").setFontSize(10.5);
      setMuted();
      const lines = doc.splitTextToSize(sanitizeReportText(stripMd(md)), contentW) as string[];
      for (const line of lines) {
        ensure(14.5);
        doc.text(line, M, y);
        y += 14.5;
      }
      y += 10;
      return;
    }

    for (const block of splitReportBlocks(md)) {
      if (block.type === "table") {
        ensure(50);
        renderTable(block.rows);
        continue;
      }
      const lines = block.text.split("\n");
      let paragraph: string[] = [];
      const flushParagraph = () => {
        if (!paragraph.length) return;
        renderParagraph(paragraph.join(" "));
        paragraph = [];
      };
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
          flushParagraph();
          continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
          flushParagraph();
          renderHeading(heading[1]!.length, heading[2]!);
          continue;
        }
        if (/^([-*_])\1{2,}$/.test(line)) {
          flushParagraph();
          renderRule();
          continue;
        }
        if (/^>\s?/.test(line)) {
          flushParagraph();
          renderParagraph(line.replace(/^>\s?/, ""));
          continue;
        }
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        if (bullet) {
          flushParagraph();
          renderListItem(bullet[1]!, null);
          continue;
        }
        const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
        if (numbered) {
          flushParagraph();
          renderListItem(numbered[2]!, `${numbered[1]}.`);
          continue;
        }
        paragraph.push(line);
      }
      flushParagraph();
    }
    y += 8;
  });

  const geo = geoTrafficFromPreview(input.datasetPreview);
  if (geo) {
    renderHeading(1, "Répartition géographique");
    renderTable([
      [geo.labelColumn || "Pays", geo.valueColumn, "Part"],
      ...geo.rows.map((row) => [
        row.label,
        row.value.toLocaleString("fr-FR", { maximumFractionDigits: 2 }),
        `${(row.share * 100).toFixed(1)} %`,
      ]),
    ]);
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    setBorder();
    doc.setLineWidth(0.5);
    doc.line(M, H - 44, W - M, H - 44);
    doc.setFont("helvetica", "normal").setFontSize(8);
    setMuted();
    doc.text("DA-Copilot - Rapport d'analyse", M, H - 30);
    doc.text(`Page ${page} / ${pages}`, W - M, H - 30, { align: "right" });
  }
}

export async function createReportPdf(input: ReportInput): Promise<ReportDoc> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  buildPdf(doc, input);
  return doc;
}

export async function exportPdf(input: ReportInput) {
  const doc = await createReportPdf(input);
  doc.save(`${fileBase(input)}.pdf`);
}

export async function exportExcel(input: ReportInput) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const summary = [
    ["Rapport d'analyse DA-Copilot"],
    ["Conversation", sanitizeReportText(input.title)],
    ["Fichier", sanitizeReportText(input.datasetName ?? "aucun")],
    ["Généré le", sanitizeReportText(new Date().toLocaleString("fr-FR"))],
    [],
    ["Rôle", "Contenu"],
    ...input.messages.map((m) => [
      m.role === "user" ? "Question" : "Analyse",
      sanitizeReportText(messageText(m)),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(summary);
  ws["!cols"] = [{ wch: 14 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ws, "Rapport");

  let n = 1;
  for (const m of input.messages) {
    if (m.role !== "assistant") continue;
    for (const t of extractMarkdownTables(messageText(m))) {
      if (n > 20) break;
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(t.map((row) => row.map((cell) => sanitizeCell(cell)))),
        `Tableau ${n++}`,
      );
    }
  }
  const geo = geoTrafficFromPreview(input.datasetPreview);
  if (geo) {
    const rows = [
      [geo.labelColumn, geo.valueColumn, "Part"],
      ...geo.rows.map((row) => [
        row.label,
        row.value,
        Number((row.share * 100).toFixed(1)),
      ]),
    ];
    const geoSheet = XLSX.utils.aoa_to_sheet(rows);
    geoSheet["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, geoSheet, "Géographie");
  }
  if (input.datasetPreview) {
    const rows = input.datasetPreview.split("\n").map((r) => r.split(","));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Extrait données");
  }
  XLSX.writeFile(wb, `${fileBase(input)}.xlsx`);
}
