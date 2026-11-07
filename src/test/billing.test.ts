import { describe, expect, it } from "vitest";

import { FREE_MAX_ROWS, PRO_MAX_ROWS, TEAM_MAX_ROWS, maxFileMb, maxRows } from "@/lib/billing";

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
});
