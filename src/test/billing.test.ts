import { describe, expect, it } from "vitest";

import {
  canAnalyze,
  exceedsFreeLimit,
  FREE_ANALYSIS_LIMIT,
  FREE_MAX_ROWS,
  isAllowedOrigin,
  maxFileMb,
  maxRows,
  PRO_MAX_ROWS,
  TEAM_MAX_ROWS,
} from "@/lib/billing";

describe("plan limits", () => {
  it("exposes row limits per plan", () => {
    expect(maxRows("free")).toBe(FREE_MAX_ROWS);
    expect(maxRows("pro")).toBe(PRO_MAX_ROWS);
    expect(maxRows("team")).toBe(TEAM_MAX_ROWS);
    expect(maxRows("free")).toBeLessThan(maxRows("pro"));
    expect(maxRows("pro")).toBeLessThan(maxRows("team"));
  });

  it("exposes file size limits per plan", () => {
    expect(maxFileMb("free")).toBeLessThan(maxFileMb("pro"));
    expect(maxFileMb("pro")).toBeLessThan(maxFileMb("team"));
  });

  it("bloque la 6e analyse gratuite et autorise les 5 premières", () => {
    expect(FREE_ANALYSIS_LIMIT).toBe(5);
    for (let used = 0; used < FREE_ANALYSIS_LIMIT; used += 1) {
      expect(canAnalyze(false, used)).toBe(true);
    }
    expect(canAnalyze(false, FREE_ANALYSIS_LIMIT)).toBe(false);
    expect(canAnalyze(true, FREE_ANALYSIS_LIMIT)).toBe(true);

    for (let after = 1; after <= FREE_ANALYSIS_LIMIT; after += 1) {
      expect(exceedsFreeLimit(false, after)).toBe(false);
    }
    expect(exceedsFreeLimit(false, FREE_ANALYSIS_LIMIT + 1)).toBe(true);
    expect(exceedsFreeLimit(true, FREE_ANALYSIS_LIMIT + 1)).toBe(false);
  });

  it("n'accepte que les origines de confiance pour Stripe", () => {
    expect(isAllowedOrigin("https://da-copilot.lovable.app")).toBe(true);
    expect(isAllowedOrigin("https://abc.lovableproject.com")).toBe(true);
    expect(isAllowedOrigin("http://localhost:8080")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:4173")).toBe(true);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin("http://da-copilot.lovable.app")).toBe(false);
    expect(isAllowedOrigin("https://user:pass@da-copilot.lovable.app")).toBe(false);
    expect(isAllowedOrigin("javascript:alert(1)")).toBe(false);
  });
});
