import { describe, it, expect } from "vitest";
import { formatProfileForPrompt, parseNumeric, profileDataset, profileSummary } from "@/lib/dataset-profile";

describe("parseNumeric", () => {
  it("handles integers, decimals and separators", () => {
    expect(parseNumeric("42")).toBe(42);
    expect(parseNumeric("3,5")).toBe(3.5);
    expect(parseNumeric("1 234,50")).toBe(1234.5);
    expect(parseNumeric("1,234.50")).toBe(1234.5);
    expect(parseNumeric("abc")).toBeNull();
    expect(parseNumeric("")).toBeNull();
  });
});

describe("profileDataset", () => {
  const rows = [
    ["Nom", "Age", "Ville", "Actif"],
    ["Alice", "30", "Paris", "oui"],
    ["Bob", "25", "Lyon", "non"],
    ["Carla", "", "Paris", "oui"],
  ];

  it("profiles every row and column", () => {
    const profile = profileDataset(rows, "test.csv");
    expect(profile.rows).toBe(3);
    expect(profile.columns).toBe(4);
    expect(profile.nullCells).toBe(1);
    expect(profileSummary(profile)).toBe("3 lignes × 4 colonnes");

    const age = profile.columnProfiles.find((c) => c.name === "Age");
    expect(age?.type).toBe("number");
    expect(age?.min).toBe(25);
    expect(age?.max).toBe(30);
    expect(age?.mean).toBe(27.5);

    const city = profile.columnProfiles.find((c) => c.name === "Ville");
    expect(city?.type).toBe("text");
    expect(city?.top?.[0]).toEqual({ value: "Paris", count: 2 });

    const active = profile.columnProfiles.find((c) => c.name === "Actif");
    expect(active?.type).toBe("boolean");
  });

  it("formats a prompt with the full-file profile", () => {
    const prompt = formatProfileForPrompt(profileDataset(rows, "test.csv"));
    expect(prompt).toContain("3 lignes × 4 colonnes");
    expect(prompt).toContain("Profil statistique calculé sur l'intégralité du fichier");
    expect(prompt).toContain("Échantillon de 3 lignes");
  });

  it("computes histograms and correlations on the full file", () => {
    const profile = profileDataset(
      [
        ["X", "Y"],
        ["1", "2"],
        ["2", "4"],
        ["3", "6"],
        ["4", "8"],
      ],
      "corr.csv",
    );
    expect(profile.histograms).toHaveLength(2);
    expect(profile.histograms?.[0]?.bins).toHaveLength(20);
    expect(profile.histograms?.[0]?.bins.reduce((total, bin) => total + bin.count, 0)).toBe(4);
    expect(profile.correlations).toHaveLength(1);
    expect(profile.correlations?.[0]?.r).toBeCloseTo(1, 5);
  });
});
