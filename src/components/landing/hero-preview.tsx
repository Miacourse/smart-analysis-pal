import { ArrowUpRight, Euro, ShoppingCart, Sparkles, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

const revenue = [
  { mois: "Jan", ca: 32 },
  { mois: "Fév", ca: 41 },
  { mois: "Mar", ca: 38 },
  { mois: "Avr", ca: 52 },
  { mois: "Mai", ca: 58 },
  { mois: "Juin", ca: 67 },
];

const kpis = [
  { label: "CA total", value: "248 500 €", detail: "+12,4 % vs 2024", icon: Euro },
  { label: "Croissance", value: "+12,4 %", detail: "6 derniers mois", icon: TrendingUp },
  { label: "Panier moyen", value: "84 €", detail: "+9 € vs 2024", icon: ShoppingCart },
];

export function HeroPreview() {
  return (
    <div className="relative mx-auto mt-14 max-w-5xl px-4 sm:px-6">
      <span className="absolute -top-3 right-5 z-10 rounded-full border border-primary/20 bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm sm:right-10">
        Exemple
      </span>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5 lg:-rotate-1">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
          </div>
          <span className="min-w-0 truncate font-mono text-xs font-medium text-foreground">
            ventes_2025.csv
          </span>
          <span className="ml-auto shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
            12 480 lignes analysées
          </span>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {kpis.map(({ label, value, detail, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-2 font-display text-xl font-bold text-foreground">{value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Évolution du chiffre d&apos;affaires</p>
                <span className="text-[11px] text-muted-foreground">2025</span>
              </div>
              <div className="mt-3 h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="hero-ca" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="mois"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      formatter={(value) => [`${Number(value)} k€`, "CA"]}
                      labelFormatter={(label) => `${String(label)} 2025`}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 11,
                        color: "var(--foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ca"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      fill="url(#hero-ca)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-primary/20 bg-secondary/50 p-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="h-4 w-4" />
                  Recommandation
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  Concentrez vos efforts sur la région Sud : +18 % de CA et un panier moyen
                  supérieur de 9 €.
                </p>
              </div>
              <p className="mt-4 flex items-center gap-1 text-[11px] font-medium text-primary">
                Voir le détail <ArrowUpRight className="h-3.5 w-3.5" />
              </p>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Données fictives — exemple d&apos;analyse.
          </p>
        </div>
      </div>
    </div>
  );
}
