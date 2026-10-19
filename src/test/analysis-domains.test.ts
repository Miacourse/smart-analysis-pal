import { describe, expect, it } from "vitest";

import { ANALYSIS_DOMAINS, domainInstructions, getAnalysisDomain } from "@/lib/analysis-domains";

describe("analysis domains", () => {
  it("has unique ids and complete metadata", () => {
    const ids = ANALYSIS_DOMAINS.map((domain) => domain.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const domain of ANALYSIS_DOMAINS) {
      expect(domain.label.length).toBeGreaterThan(0);
      expect(domain.description.length).toBeGreaterThan(0);
      expect(domain.prompt.length).toBeGreaterThan(20);
      expect(domain.examples.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("falls back to the generalist domain", () => {
    expect(getAnalysisDomain("unknown").id).toBe("general");
    expect(getAnalysisDomain(null).id).toBe("general");
  });

  it("returns geophysics instructions with domain recipes", () => {
    const prompt = domainInstructions("geophysics");
    expect(prompt).toContain("GÉOPHYSIQUE");
    expect(prompt).toContain("heatmap");
  });

  it("covers scientific and business domains", () => {
    for (const id of [
      "geophysics",
      "geochemistry",
      "geology",
      "marketing",
      "finance",
      "healthcare",
      "logistics",
      "environment",
      "research",
    ] as const) {
      expect(getAnalysisDomain(id).id).toBe(id);
    }
  });
});
