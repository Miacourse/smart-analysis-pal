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
    expect(parseChartSpecs('```chart\n{"type":"pie","data":[]}\n```')).toHaveLength(0);
  });

  it("keeps a single series for pie and scatter", () => {
    const specs = parseChartSpecs(`\`\`\`chart
{"type":"pie","xKey":"Cat","yKeys":["A","B"],"data":[{"Cat":"x","A":1,"B":2}]}
\`\`\``);
    expect(specs[0]?.yKeys).toEqual(["A"]);
  });

  it("converts simple Vega-Lite specs to a renderable recharts spec", () => {
    const block = [
      "```chart",
      JSON.stringify({
        engine: "vega",
        title: "Ventes par mois",
        vegaSpec: {
          mark: "bar",
          data: { values: [{ a: "x", b: 1 }] },
          encoding: { x: { field: "a", type: "nominal" }, y: { field: "b", type: "quantitative" } },
        },
      }),
      "```",
    ].join("\n");
    const specs = parseChartSpecs(block);
    expect(specs[0]?.engine).toBe("recharts");
    expect(specs[0]?.type).toBe("bar");
    expect(specs[0]?.xKey).toBe("a");
    expect(specs[0]?.yKeys).toEqual(["b"]);
    expect(specs[0]?.title).toBe("Ventes par mois");
    expect(specs[0]?.data).toEqual([{ a: "x", b: 1 }]);
  });

  it("keeps a Vega spec that aggregates data through transforms", () => {
    const block = [
      "```chart",
      JSON.stringify({
        engine: "vega",
        vegaSpec: {
          mark: "bar",
          data: { values: [{ c: "x", v: 1 }] },
          transform: [{ aggregate: [{ op: "sum", field: "v", as: "total" }], groupby: ["c"] }],
          encoding: { x: { field: "c" }, y: { field: "total" } },
        },
      }),
      "```",
    ].join("\n");
    const specs = parseChartSpecs(block);
    expect(specs).toHaveLength(1);
    expect(["recharts", "vega"]).toContain(specs[0]?.engine);
  });

  it("drops a Vega spec without inline data", () => {
    const block = [
      "```chart",
      JSON.stringify({
        engine: "vega",
        vegaSpec: { mark: "bar", data: { url: "data.csv" } },
      }),
      "```",
    ].join("\n");
    expect(parseChartSpecs(block)).toHaveLength(0);
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

  it("drops Plotly traces without data", () => {
    const block = [
      "```chart",
      JSON.stringify({ engine: "plotly", traces: [{ type: "bar", name: "vide" }] }),
      "```",
    ].join("\n");
    expect(parseChartSpecs(block)).toHaveLength(0);
  });

  it("derives yKeys when the requested keys are absent from the data", () => {
    const block = [
      "```chart",
      JSON.stringify({
        type: "bar",
        xKey: "Canal",
        yKeys: ["Sessions", "Taux"],
        data: [
          { Canal: "Organic", Sessions_Total: 120, Taux_Conversion: 0.4 },
          { Canal: "Paid", Sessions_Total: 80, Taux_Conversion: 0.2 },
        ],
      }),
      "```",
    ].join("\n");
    const specs = parseChartSpecs(block);
    expect(specs[0]?.yKeys).toEqual(["Sessions_Total", "Taux_Conversion"]);
  });

  it("keeps several useful charts per answer", () => {
    const block = (i: number) =>
      [
        "```chart",
        JSON.stringify({
          type: "bar",
          title: `Graphique ${i}`,
          xKey: "A",
          yKeys: ["B"],
          data: [{ A: "x", B: i }],
        }),
        "```",
      ].join("\n");
    const text = Array.from({ length: 6 }, (_, i) => block(i)).join("\n");
    expect(parseChartSpecs(text)).toHaveLength(6);
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
