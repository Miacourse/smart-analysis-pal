import { describe, it, expect } from "vitest";
import { canAnalyze, canExport, maxFileBytes, FREE_ANALYSIS_LIMIT } from "@/lib/billing";

describe("free trial limits", () => {
  it("allows 5 free analyses", () => {
    expect(FREE_ANALYSIS_LIMIT).toBe(5);
    expect(canAnalyze(false, 4)).toBe(true);
    expect(canAnalyze(false, 5)).toBe(false);
  });
  it("Pro is unlimited", () => expect(canAnalyze(true, 999)).toBe(true));
  it("file size 5 Mo free, 100 Mo Pro", () => {
    expect(maxFileBytes(false)).toBe(5 * 1024 * 1024);
    expect(maxFileBytes(true)).toBe(100 * 1024 * 1024);
  });
  it("reserves PDF and Excel exports for Pro", () => {
    expect(canExport(false)).toBe(false);
    expect(canExport(true)).toBe(true);
  });
});

import { maxFileMb, planFromProduct, TEAM_PRODUCT_ID, PRO_PRODUCT_ID } from "@/lib/billing";
describe("plans", () => {
  it("file caps per plan", () => {
    expect(maxFileMb("free")).toBe(5);
    expect(maxFileMb("pro")).toBe(100);
    expect(maxFileMb("team")).toBe(250);
  });
  it("maps products to plans", () => {
    expect(planFromProduct(TEAM_PRODUCT_ID)).toBe("team");
    expect(planFromProduct(PRO_PRODUCT_ID)).toBe("pro");
    expect(planFromProduct("x")).toBe("free");
  });
});
