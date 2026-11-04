import { describe, expect, it } from "vitest";

import { countryName, geoTrafficFromPreview, parseDelimited, resolveCountry } from "@/lib/geo";
import { WORLD_COUNTRIES } from "@/lib/countries-data";

describe("resolveCountry", () => {
  it("reconnaît les noms français accentués et les codes", () => {
    expect(resolveCountry("États-Unis")?.iso).toBe("US");
    expect(resolveCountry("france")?.iso).toBe("FR");
    expect(resolveCountry("DE")?.iso).toBe("DE");
    expect(resolveCountry("Royaume-Uni")?.iso).toBe("GB");
  });

  it("ignore les libellés inconnus", () => {
    expect(resolveCountry("Atlantide")).toBeNull();
    expect(resolveCountry("??")).toBeNull();
    expect(resolveCountry("")).toBeNull();
  });
});

describe("resolveCountry Afrique", () => {
  it("reconnaît le Burkina Faso et le Bénin", () => {
    expect(resolveCountry("Burkina Faso")?.iso).toBe("BF");
    expect(resolveCountry("burkina")?.iso).toBe("BF");
    expect(resolveCountry("B\u00e9nin")?.iso).toBe("BJ");
    expect(resolveCountry("Benin")?.iso).toBe("BJ");
    expect(countryName("BF")).toBe("Burkina Faso");
    expect(countryName("BJ")).toBe("B\u00e9nin");
  });
});

describe("WORLD_COUNTRIES dataset", () => {
  it("couvre les 250 pays et les noms FR/EN sont résolubles", () => {
    expect(WORLD_COUNTRIES.length).toBe(250);
    const unresolved: string[] = [];
    for (const country of WORLD_COUNTRIES) {
      if (!resolveCountry(country.fr) || !resolveCountry(country.en)) {
        unresolved.push(country.iso);
      }
      expect(countryName(country.iso)).toBe(country.fr);
    }
    expect(unresolved).toEqual([]);
  });
});

describe("countryName", () => {
  it("affiche le nom complet des pays, y compris hors de la liste cartographique", () => {
    expect(countryName("FR")).toBe("France");
    expect(countryName("GB")).toBe("Royaume-Uni");
    expect(countryName("CD")).toMatch(/Congo/);
    expect(countryName("CD")).not.toBe("CD");
  });
});

describe("parseDelimited", () => {
  it("accepte les points-virgules et les guillemets", () => {
    expect(parseDelimited('Pays;Sessions\n"France";"1 200"\n')).toEqual([
      ["Pays", "Sessions"],
      ["France", "1 200"],
    ]);
  });
});

describe("geoTrafficFromPreview", () => {
  const preview = [
    "Pays,Sessions,Revenu",
    "France,1200,4500",
    "Allemagne,800,3200",
    "États-Unis,300,1800",
  ].join("\n");

  it("agrège par pays et préfère la colonne de volume", () => {
    const geo = geoTrafficFromPreview(preview);
    expect(geo).not.toBeNull();
    expect(geo!.valueColumn).toBe("Sessions");
    expect(geo!.labelColumn).toBe("Pays");
    expect(geo!.points.map((point) => point.label)).toEqual(["France", "Allemagne", "États-Unis"]);
    expect(geo!.points[0]!.value).toBe(1200);
  });

  it("retourne null sans colonne géographique", () => {
    expect(geoTrafficFromPreview("Canal,Sessions\nEmail,10\nDirect,20")).toBeNull();
  });

  it("retourne null si aucun pays n'est reconnu", () => {
    expect(geoTrafficFromPreview("Pays,Visites\nAtlantide,10\nMordor,5")).toBeNull();
  });
});
