import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AI_PROVIDER_NAME, SUPPORT_EMAIL } from "@/lib/legal";
import { useLang } from "@/lib/i18n";

export function LandingFaq() {
  const { t } = useLang();

  const faq = [
    {
      question: t("Les 5 analyses gratuites, c'est par mois ?"),
      answer: t(
        "Non. Les 5 analyses offertes sont valables une seule fois et ne se renouvellent pas chaque mois. Une fois le quota utilisé, il faut passer à Pro ou Team pour continuer.",
      ),
    },
    {
      question: t("Quels formats de fichiers sont acceptés ?"),
      answer: t(
        "CSV, TSV, TXT, Excel (.xlsx et .xls), JSON, GeoJSON et LAS. Le fichier est lu dans votre navigateur avant l'analyse.",
      ),
    },
    {
      question: t("Mes données sont-elles conservées ?"),
      answer: t(
        "Le fichier d'origine n'est jamais conservé. Pour réafficher votre jeu de données dans la conversation, nous gardons uniquement un aperçu des 40 premières lignes au format CSV, un résumé statistique (colonnes, types, valeurs manquantes) et les messages échangés. Vous pouvez supprimer la conversation depuis la barre latérale, ce qui supprime aussi cet historique. Évitez les données personnelles ou sensibles.",
      ),
    },
    {
      question: t("Puis-je exporter mes résultats ?"),
      answer: t(
        "Oui, en PDF et Excel, avec les offres Pro et Team. L'offre gratuite ne comprend pas les exports.",
      ),
    },
    {
      question: t("Comment résilier ?"),
      answer: t(
        "Depuis la page Tarifs, le bouton « Gérer mon abonnement » ouvre le portail Stripe, où vous pouvez annuler le renouvellement.",
      ),
    },
    {
      question: t("Mes données servent-elles à entraîner une IA ?"),
      answer:
        t(
          "Non. DA-Copilot ne réentraîne aucun modèle avec vos données. L'analyse est générée via",
        ) +
        ` ${AI_PROVIDER_NAME} ` +
        t(
          "à partir de votre question, de l'aperçu CSV et du résumé statistique. Le fichier d'origine n'est pas transmis. Évitez les données personnelles ou sensibles.",
        ),
    },
    {
      question: t("Comment vous contacter ?"),
      answer:
        t("Écrivez-nous à") +
        ` ${SUPPORT_EMAIL}. ` +
        t(
          "Nous répondons sous 48 heures ouvrées. Pour une suppression de compte, vous pouvez aussi nous écrire depuis cet email.",
        ),
    },
  ];

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight">
          {t("Questions fréquentes")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          {t("Les réponses essentielles avant de lancer votre première analyse.")}
        </p>
        <Accordion type="single" collapsible className="mt-8">
          {faq.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
