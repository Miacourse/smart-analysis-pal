import { describe, it, expect } from "vitest";
import { buildChartData, parseChartSpecs, stripChartBlocks } from "@/lib/chart-spec";

const text = `Voici le résultat.

\`\`\`chart
{"type":"bar","title":"Survie par classe","xKey":"Classe","yKeys":["Survivants"],"data":[{"Classe":"1","Survivants":136},{"Classe":"2","Survivants":87},{"Classe":"3","Survivants":119}]}
\`\`\`

Conclusion.`;

describe("parseChartSpecs", () => {
  it("extracts and normalizes a chart block", () => {
    const specs = parseChartSpecs(text);
    expect(specs).toHaveLength(1);
    const spec = specs[0];
    expect(spec?.type).toBe("bar");
    expect(spec?.title).toBe("Survie par classe");
    expect(spec?.xKey).toBe("Classe");
    expect(spec?.yKeys).toEqual(["Survivants"]);
    expect(spec?.data).toHaveLength(3);
  });

  it("derives the series when yKeys is missing", () => {
    const specs = parseChartSpecs(`\`\`\`chart
{"type":"line","xKey":"Mois","data":[{"Mois":"Jan","Ventes":"1 200"},{"Mois":"Fév","Ventes":"1 500"}]}
\`\`\``);
    expect(specs[0]?.yKeys).toEqual(["Ventes"]);
  });

  it("ignores invalid blocks", () => {
    expect(parseChartSpecs("```chart\n{not json}\n```")).toHaveLength(0);
    expect(parseChartSpecs("```chart\n{\"type\":\"pie\",\"data\":[]}\n```")).toHaveLength(0);
  });

  it("keeps a single series for pie and scatter", () => {
    const specs = parseChartSpecs(`\`\`\`chart
{"type":"pie","xKey":"Cat","yKeys":["A","B"],"data":[{"Cat":"x","A":1,"B":2}]}
\`\`\``);
    expect(specs[0]?.yKeys).toEqual(["A"]);
  });

  it("routes Vega-Lite specs to the vega engine", () => {
    const block = [
      "```chart",
      JSON.stringify({
        engine: "vega",
        vegaSpec: {
          mark: "bar",
          data: { values: [{ a: "x", b: 1 }] },
          encoding: { x: { field: "a", type: "nominal" }, y: { field: "b", type: "quantitative" } },
        },
      }),
      "```",
    ].join("\n");
    const specs = parseChartSpecs(block);
    expect(specs[0]?.engine).toBe("vega");
    expect(specs[0]?.vegaSpec?.["mark"]).toBe("bar");
  });

  it("routes Plotly traces to the plotly engine", () => {
    const block = [
      "```chart",
      JSON.stringify({
        engine: "plotly",
        title: "Diagramme ternaire",
        traces: [{ type: "scatterternary", a: [1], b: [2], c: [3] }],
        layout: { ternary: { sum: 100 } },
      }),
      "```",
    ].join("\n");
    const specs = parseChartSpecs(block);
    expect(specs[0]?.engine).toBe("plotly");
    expect(specs[0]?.traces).toHaveLength(1);
    expect(specs[0]?.title).toBe("Diagramme ternaire");
  });

  it("defaults tabular specs to recharts", () => {
    const block = [
      "```chart",
      JSON.stringify({ type: "bar", xKey: "A", data: [{ A: "x", B: 1 }] }),
      "```",
    ].join("\n");
    expect(parseChartSpecs(block)[0]?.engine).toBe("recharts");
  });
});

describe("stripChartBlocks", () => {
  it("removes the chart payload from rendered markdown", () => {
    const cleaned = stripChartBlocks(text);
    expect(cleaned).not.toContain("```chart");
    expect(cleaned).not.toContain("Survivants");
    expect(cleaned).toContain("Voici le résultat.");
    expect(cleaned).toContain("Conclusion.");
  });
});

describe("buildChartData", () => {
  it("coerces numeric strings and keeps labels", () => {
    const [spec] = parseChartSpecs(`\`\`\`chart
{"type":"bar","xKey":"Classe","yKeys":["Taux"],"data":[{"Classe":"1","Taux":"63%"},{"Classe":"2","Taux":"47 %"}]}
\`\`\``);
    const data = spec ? buildChartData(spec) : [];
    expect(data).toEqual([
      { Classe: "1", Taux: 63 },
      { Classe: "2", Taux: 47 },
    ]);
  });
});
