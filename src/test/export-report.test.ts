import { describe, expect, it } from "vitest";
import {
  extractMarkdownTables,
  reportTitle,
  sanitizeReportText,
  splitReportBlocks,
} from "@/lib/export-report";

describe("extractMarkdownTables", () => {
  it("extrait un tableau et ignore la ligne de séparation", () => {
    const md = [
      "## Résultat",
      "",
      "| Ville | Marge |",
      "|-------|-------|",
      "| Rennes | 22,0 |",
      "| Lyon | 21,0 |",
      "",
      "Fin.",
    ].join("\n");
    const tables = extractMarkdownTables(md);
    expect(tables).toHaveLength(1);
    expect(tables[0]).toEqual([
      ["Ville", "Marge"],
      ["Rennes", "22,0"],
      ["Lyon", "21,0"],
    ]);
  });
});

describe("splitReportBlocks", () => {
  it("sépare le texte et les tableaux en conservant l'ordre", () => {
    const md = ["Intro.", "| A | B |", "|---|---|", "| 1 | 2 |", "Conclusion."].join("\n");
    const blocks = splitReportBlocks(md);
    expect(blocks.map((b) => b.type)).toEqual(["text", "table", "text"]);
    const table = blocks[1]!;
    expect(table.type).toBe("table");
    if (table.type === "table") {
      expect(table.rows).toEqual([
        ["A", "B"],
        ["1", "2"],
      ]);
    }
  });

  it("retire les marqueurs gras des cellules", () => {
    const blocks = splitReportBlocks("| **Gras** | x |\n|---|---|\n| **a** | b |");
    const table = blocks[0]!;
    if (table.type === "table") {
      expect(table.rows[0]![0]).toBe("Gras");
      expect(table.rows[1]![0]).toBe("a");
    }
  });
});

describe("sanitizeReportText", () => {
  it("neutralise les artefacts typographiques IA", () => {
    const input = "Résultat — clé → action ✨ ✅ “optimal” … 12 %\u00A0de marge";
    const output = sanitizeReportText(input);
    expect(output).not.toMatch(/[—→✨✅“”…]/);
    expect(output).toContain("->");
    expect(output).toContain('"optimal"');
    expect(output).toContain("...");
    expect(output).not.toContain("\u00A0");
  });

  it("conserve les accents français", () => {
    expect(sanitizeReportText("Décision stratégique à l'été")).toBe(
      "Décision stratégique à l'été",
    );
  });

  it("convertit le LaTeX brut en texte lisible", () => {
    const input =
      "Taux = $\\frac{\\text{Key events}}{\\text{Sessions}} \\times 100$ et \\approx 2,4\\%";
    const output = sanitizeReportText(input);
    expect(output).not.toMatch(/\\|\$|\{|\}/);
    expect(output).toContain("(Key events) / (Sessions)");
    expect(output).toContain("x 100");
    expect(output).toContain("environ 2,4%");
  });

  it("retire les balises HTML résiduelles", () => {
    expect(sanitizeReportText("Ligne<br/>suivante")).toBe("Ligne suivante");
  });

  it("décode les entités HTML", () => {
    expect(sanitizeReportText("Display &amp; Paid Social &rightarrow; Paid Search &ge; 2")).toBe(
      "Display & Paid Social -> Paid Search >= 2",
    );
    expect(sanitizeReportText("Marge &#8594; hausse")).toBe("Marge -> hausse");
  });
});

describe("reportTitle", () => {
  it("priorise le nom du fichier pour éviter les titres tronqués", () => {
    expect(reportTitle({ title: "Analyse les sessions par canal d'acqui", datasetName: "ga4-acquisition.csv" })).toBe(
      "Analyse de Ga4 acquisition",
    );
  });

  it("retombe sur le titre sans fichier", () => {
    expect(reportTitle({ title: "Bilan trimestriel", datasetName: null })).toBe("Bilan trimestriel");
  });
});
