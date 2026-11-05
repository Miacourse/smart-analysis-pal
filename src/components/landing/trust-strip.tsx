import { CreditCard, ListChecks, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";

export function TrustStrip() {
  const { t } = useLang();
  const points = [
    { icon: ShieldCheck, text: t("Fichier original non conservé") },
    { icon: ListChecks, text: t("Analyse en 5 étapes visibles") },
    { icon: CreditCard, text: t("Sans carte bancaire pour commencer") },
  ];

  return (
    <section
      className="border-y border-border bg-card/60"
      aria-label={t("Confiance et confidentialité")}
    >
      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6">
        {points.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-center text-xs font-medium text-muted-foreground sm:rounded-xl sm:py-3"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
