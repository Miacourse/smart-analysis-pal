import { describe, expect, it } from "vitest";

import { geoTrafficFromPreview, parseDelimited, resolveCountry } from "@/lib/geo";

describe("resolveCountry", () => {
  it("reconnaît les noms français accentués et les codes", () => {
    expect(resolveCountry("États-Unis")?.iso).toBe("US");
    expect(resolveCountry("france")?.iso).toBe("FR");
    expect(resolveCountry("DE")?.iso).toBe("DE");
    expect(resolveCountry("Royaume-Uni")?.iso).toBe("GB");
  });

  it("ignore les libellés inconnus", () => {
    expect(resolveCountry("Atlantide")).toBeNull();
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
    expect(geo!.points.map((point) => point.label)).toEqual(["FR", "DE", "US"]);
    expect(geo!.points[0]!.value).toBe(1200);
  });

  it("retourne null sans colonne géographique", () => {
    expect(geoTrafficFromPreview("Canal,Sessions\nEmail,10\nDirect,20")).toBeNull();
  });

  it("retourne null si aucun pays n'est reconnu", () => {
    expect(geoTrafficFromPreview("Pays,Visites\nAtlantide,10\nMordor,5")).toBeNull();
  });
});
