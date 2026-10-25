import { Fragment } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import type { DatasetProfile } from "@/lib/dataset-profile";

const compact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatNumber = (value: number) => (Number.isFinite(value) ? compact.format(value) : "—");

function correlationColor(r: number) {
  const alpha = 0.12 + Math.abs(r) * 0.75;
  return r >= 0 ? `rgba(37, 99, 235, ${alpha})` : `rgba(220, 38, 38, ${alpha})`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export function AnalysisOverview({ profile }: { profile: DatasetProfile }) {
  const numeric = profile.columnProfiles.filter((column) => column.type === "number");
  const missing =
    profile.rows * profile.columns > 0 ? profile.nullCells / (profile.rows * profile.columns) : 0;
  const histograms = (profile.histograms ?? []).slice(0, 4);
  const names = numeric.slice(0, 8).map((column) => column.name);
  const correlationMap = new Map(
    (profile.correlations ?? []).map((cell) => [`${cell.a}\u0001${cell.b}`, cell.r] as const),
  );
  const correlation = (a: string, b: string) => {
    if (a === b) return 1;
    return correlationMap.get(`${a}\u0001${b}`) ?? correlationMap.get(`${b}\u0001${a}`) ?? null;
  };

  const profiledRows = profile.profiledRows ?? profile.rows;
  const nonNumeric = profile.columnProfiles.reduce(
    (total, column) => total + (column.nonNumeric ?? 0),
    0,
  );
  const outliers = profile.columnProfiles.reduce(
    (total, column) => total + (column.outliers ?? 0),
    0,
  );
  const constants = profile.columnProfiles.filter((column) => column.constant).length;
  const whitespace = profile.columnProfiles.reduce(
    (total, column) => total + (column.whitespace ?? 0),
    0,
  );
  const issues: { label: string; detail: string }[] = [];
  if (profile.nullCells > 0)
    issues.push({
      label: `${profile.nullCells.toLocaleString("fr-FR")} cellule(s) vide(s)`,
      detail: "imputation ou suppression",
    });
  if (profile.duplicateRows > 0)
    issues.push({
      label: `${profile.duplicateRows.toLocaleString("fr-FR")} ligne(s) dupliquée(s)`,
      detail: "dédoublonnage",
    });
  if (nonNumeric > 0)
    issues.push({
      label: `${nonNumeric.toLocaleString("fr-FR")} valeur(s) non numérique(s) en colonne numérique`,
      detail: "conversion ou correction",
    });
  if (outliers > 0)
    issues.push({
      label: `${outliers.toLocaleString("fr-FR")} valeur(s) aberrante(s) (IQR 1,5)`,
      detail: "vérification, plafonnement ou retrait",
    });
  if (constants > 0)
    issues.push({
      label: `${constants} colonne(s) constante(s)`,
      detail: "sans pouvoir discriminant",
    });
  if (whitespace > 0)
    issues.push({
      label: `${whitespace.toLocaleString("fr-FR")} valeur(s) avec espaces parasites`,
      detail: "nettoyage des espaces",
    });

  return (
    <div className="mt-6 w-full max-w-2xl space-y-4 text-left">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Lignes" value={profile.rows.toLocaleString("fr-FR")} />
        <Stat label="Colonnes" value={profile.columns.toLocaleString("fr-FR")} />
        <Stat label="Valeurs vides" value={`${(missing * 100).toFixed(1)} %`} />
        <Stat label="Doublons" value={profile.duplicateRows.toLocaleString("fr-FR")} />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Qualité des données</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Détection sur{" "}
          {profiledRows < profile.rows
            ? `${profiledRows.toLocaleString("fr-FR")} lignes échantillonnées sur ${profile.rows.toLocaleString("fr-FR")}`
            : `${profile.rows.toLocaleString("fr-FR")} lignes`}
          .
        </p>
        {issues.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Aucun problème majeur détecté.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-xs">
            {issues.map((issue) => (
              <li key={issue.label} className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="font-medium text-foreground">{issue.label}</span>{" "}
                  <span className="text-muted-foreground">— {issue.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          L'agent explique chaque problème et propose une correction sans modifier vos données.
        </p>
      </section>

      {histograms.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Distributions (fichier complet)</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {histograms.map((histogram) => (
              <div key={histogram.name}>
                <div className="mb-1 truncate text-xs text-muted-foreground" title={histogram.name}>
                  {histogram.name}
                </div>
                <div className="h-24 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={histogram.bins.map((bin) => ({
                        label: formatNumber(bin.from),
                        count: bin.count,
                      }))}
                      margin={{ top: 2, right: 2, bottom: 0, left: 2 }}
                    >
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                        axisLine={{ stroke: "var(--border)" }}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <Tooltip
                        formatter={(value) => [formatNumber(Number(value)), "valeurs"]}
                        labelFormatter={(label) => `≥ ${String(label)}`}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 11,
                          color: "var(--foreground)",
                        }}
                      />
                      <Bar dataKey="count" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {names.length > 1 && (profile.correlations?.length ?? 0) > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Corrélations (Pearson)</h3>
          <div className="mt-3 overflow-x-auto">
            <div
              className="grid gap-1 text-[10px]"
              style={{
                gridTemplateColumns: `minmax(84px, 120px) repeat(${names.length}, minmax(30px, 1fr))`,
              }}
            >
              <div />
              {names.map((name) => (
                <div
                  key={`header-${name}`}
                  className="truncate px-0.5 text-center text-muted-foreground"
                  title={name}
                >
                  {name.slice(0, 7)}
                </div>
              ))}
              {names.map((rowName) => (
                <Fragment key={rowName}>
                  <div className="truncate pr-1 text-right text-muted-foreground" title={rowName}>
                    {rowName}
                  </div>
                  {names.map((colName) => {
                    const r = correlation(rowName, colName);
                    return (
                      <div
                        key={`${rowName}-${colName}`}
                        className="flex h-7 items-center justify-center rounded-sm font-medium"
                        title={
                          r === null
                            ? "Données insuffisantes"
                            : `${rowName} × ${colName} : r = ${r.toFixed(2)}`
                        }
                        style={
                          r === null
                            ? { color: "var(--muted-foreground)" }
                            : {
                                background: correlationColor(r),
                                color: Math.abs(r) > 0.55 ? "#fff" : "var(--foreground)",
                              }
                        }
                      >
                        {r === null ? "—" : r.toFixed(2)}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Bleu = corrélation positive, rouge = négative. Calcul sur les lignes complètes (jusqu'à
            50 000).
          </p>
        </section>
      )}

      <div className="flex flex-wrap justify-center gap-1.5">
        {profile.columnProfiles.slice(0, 12).map((column) => (
          <span
            key={column.name}
            className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            title={`${column.type} · ${column.nulls} vides`}
          >
            {column.name} <span className="opacity-60">{column.type}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
