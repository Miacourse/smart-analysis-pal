import type { UIMessage } from "ai";

type ReportInput = {
  title: string;
  datasetName: string | null;
  datasetPreview: string | null;
  messages: UIMessage[];
};

function messageText(m: UIMessage) {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .filter(Boolean)
    .join("\n");
}

function stripMd(s: string) {
  return s
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

function fileBase(input: ReportInput) {
  const d = new Date().toISOString().slice(0, 10);
  const base = (input.datasetName ?? input.title ?? "analyse").replace(/\.[^.]+$/, "");
  return `rapport-${base.replace(/[^\w-]+/g, "_")}-${d}`;
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
      const cells = line.slice(1, -1).split("|").map((c) => c.trim().replace(/\*\*/g, ""));
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

export async function exportPdf(input: ReportInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  doc.setFont("helvetica", "bold").setFontSize(18).text("Rapport d'analyse DA-Copilot", M, y);
  y += 24;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  doc.text(`Conversation : ${input.title}`, M, y);
  y += 14;
  doc.text(`Fichier : ${input.datasetName ?? "aucun"}`, M, y);
  y += 14;
  doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`, M, y);
  y += 24;
  doc.setTextColor(20);

  const renderTable = (rows: string[][]) => {
    const avail = W - 2 * M;
    const cols = Math.max(...rows.map((r) => r.length));
    const weights: number[] = new Array(cols).fill(1);
    for (const r of rows) {
      for (let c = 0; c < cols; c++) {
        weights[c] = Math.max(weights[c]!, (r[c] ?? "").length);
      }
    }
    const totalW = weights.reduce((a, b) => a + b, 0) || 1;
    const colW: number[] = weights.map((w) => (w / totalW) * avail);
    const pad = 4;
    const lineH = 11;
    const fontH = 9.5;
    const drawRow = (r: string[], bold: boolean, header: boolean) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(fontH);
      const cellLines: string[][] = r.map((cell, c) =>
        doc.splitTextToSize(cell ?? "", colW[c]! - 2 * pad) as string[],
      );
      const rowH = Math.max(1, ...cellLines.map((l) => l.length)) * lineH + 2 * pad;
      if (y + rowH > H - M) {
        doc.addPage();
        y = M;
      }
      let x = M;
      for (let c = 0; c < cols; c++) {
        if (header) {
          doc.setFillColor(238, 240, 244);
          doc.rect(x, y - fontH - 2, colW[c]!, rowH, "F");
        }
        doc.setDrawColor(205, 210, 218);
        doc.rect(x, y - fontH - 2, colW[c]!, rowH);
        let ty = y + 2;
        for (const ln of cellLines[c]!) {
          doc.text(ln, x + pad, ty);
          ty += lineH;
        }
        x += colW[c]!;
      }
      y += rowH + 1;
    };
    drawRow(rows[0]!, true, true);
    for (let i = 1; i < rows.length; i++) drawRow(rows[i]!, false, false);
    y += 8;
    doc.setDrawColor(20);
  };

  for (const m of input.messages) {
    const md = messageText(m).trim();
    if (!md) continue;
    ensure(30);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20);
    doc.text(m.role === "user" ? "Question" : "Analyse", M, y);
    y += 16;
    for (const block of splitReportBlocks(md)) {
      if (block.type === "table") {
        ensure(40);
        renderTable(block.rows);
        continue;
      }
      const text = stripMd(block.text).replace(/^\s*>\s?/gm, "").trim();
      if (!text) continue;
      doc.setFont("helvetica", "normal").setFontSize(10);
      const lines = doc.splitTextToSize(text, W - 2 * M) as string[];
      for (const l of lines) {
        ensure(13);
        doc.text(l, M, y);
        y += 13;
      }
      y += 6;
    }
    y += 10;
  }
  doc.save(`${fileBase(input)}.pdf`);
}

export async function exportExcel(input: ReportInput) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const summary = [
    ["Rapport d'analyse DA-Copilot"],
    ["Conversation", input.title],
    ["Fichier", input.datasetName ?? "aucun"],
    ["Généré le", new Date().toLocaleString("fr-FR")],
    [],
    ["Rôle", "Contenu"],
    ...input.messages.map((m) => [m.role === "user" ? "Question" : "Analyse", messageText(m)]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(summary);
  ws["!cols"] = [{ wch: 14 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ws, "Rapport");

  let n = 1;
  for (const m of input.messages) {
    if (m.role !== "assistant") continue;
    for (const t of extractMarkdownTables(messageText(m))) {
      if (n > 20) break;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t), `Tableau ${n++}`);
    }
  }
  if (input.datasetPreview) {
    const rows = input.datasetPreview.split("\n").map((r) => r.split(","));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Extrait données");
  }
  XLSX.writeFile(wb, `${fileBase(input)}.xlsx`);
}
