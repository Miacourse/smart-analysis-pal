import { describe, expect, it } from "vitest";
import { analysisStep, clarificationColumns, dashboardKey, emptyReferencedColumn, readDashboardIds, saveDashboardId } from "@/lib/brand-state";
import { profileDataset } from "@/lib/dataset-profile";

describe("Datello states", () => {
  const profile = profileDataset([["Produit", "Montant", "Date"], ["A", "12", ""], ["B", "18", ""]], "ventes.csv");
  it("suggests columns only for an explicit clarification", () => {
    expect(clarificationColumns("Quelle colonne : Produit ou Montant ?", profile)).toEqual(["Produit", "Montant"]);
    expect(clarificationColumns("Le montant total est 30.", profile)).toEqual([]);
  });
  it("warns only about a referenced entirely empty column", () => {
    expect(emptyReferencedColumn("Comparer par Date", profile)).toBe("Date");
    expect(emptyReferencedColumn("Comparer par Produit", profile)).toBeNull();
  });
  it("keeps calculations active until the response finishes", () => {
    expect(analysisStep("ai", false)).toBe(0);
    expect(analysisStep("ai", true)).toBe(1);
    expect(analysisStep("charts", false)).toBe(2);
  });
  it("saves dashboards once and isolates accounts", () => {
    localStorage.removeItem(dashboardKey("one"));
    localStorage.removeItem(dashboardKey("two"));
    saveDashboardId("one", "analysis-1");
    saveDashboardId("one", "analysis-1");
    expect(readDashboardIds("one")).toEqual(["analysis-1"]);
    expect(readDashboardIds("two")).toEqual([]);
  });
});