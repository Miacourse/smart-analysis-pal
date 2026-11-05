import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

const LANG_KEY = "da-lang";

/** English strings, keyed by the French source string. Missing keys fall back to French. */
const EN: Record<string, string> = {
  "Mes fichiers": "My files",
  "Tableaux de bord": "Dashboards",
  "Fichiers récents": "Recent files",
  "Aucun fichier associé": "No file attached",
  Arrêter: "Stop",
  Analyser: "Analyze",
  "Importer un fichier CSV ou Excel": "Upload a CSV or Excel file",
  "Posez une question sur vos données…": "Ask a question about your data…",
  "Vos données,": "Your data,",
  "enfin claires.": "finally clear.",
  "Retrouvez les fichiers importés et reprenez une analyse.":
    "Find your imported files and resume an analysis.",
  "Chargement de vos fichiers…": "Loading your files…",
  "Aucun fichier pour le moment.": "No files yet.",
  "Ouvrez une conversation puis importez un fichier CSV ou Excel.":
    "Open a conversation, then upload a CSV or Excel file.",
  "Reprenez vos analyses enregistrées et leurs graphiques.":
    "Resume your saved analyses and their charts.",
  "Chargement de vos tableaux de bord…": "Loading your dashboards…",
  "Aucun tableau de bord pour le moment.": "No dashboards yet.",
  "Chaque analyse terminée apparaît ici avec ses graphiques.":
    "Every completed analysis appears here with its charts.",
  "Page introuvable": "Page not found",
  "La page que vous cherchez n'existe pas ou a été déplacée.":
    "The page you are looking for does not exist or has been moved.",
  "Retour à l'accueil": "Back to home",
  "Cette page n'a pas pu se charger": "This page could not load",
  "Une erreur est survenue. Réessayez ou revenez à l'accueil.":
    "An error occurred. Try again or go back to the home page.",
  Réessayer: "Retry",
  Accueil: "Home",
  Tarifs: "Pricing",
  "Se connecter": "Sign in",
  "Analyser mes données": "Analyze my data",
  "Ouvrir le menu": "Open the menu",
  Menu: "Menu",
  "Agent d'analyse de données — {count} modes métier, rapports prêts à partager":
    "Data analysis agent — {count} business modes, reports ready to share",
  "Vos données deviennent des": "Your data becomes",
  décisions: "decisions",
  "Téléversez un fichier (CSV, Excel, JSON…), posez votre question métier en langage naturel, et recevez une réponse claire, chiffrée et vérifiable : KPI, tendances, anomalies et recommandations actionnables.":
    "Upload a file (CSV, Excel, JSON…), ask your business question in natural language, and receive a clear, quantified, verifiable analysis: KPIs, trends, anomalies and actionable recommendations.",
  "Voir les tarifs": "View pricing",
  "Une méthode rigoureuse en 5 étapes": "A rigorous 5-step method",
  "Chaque analyse suit le même pipeline reproductible, du profilage brut jusqu'aux recommandations.":
    "Every analysis follows the same reproducible pipeline, from raw profiling to recommendations.",
  "Étape {n}": "Step {n}",
  "Pensé pour le monde des données": "Built for the world of data",
  "Choisissez votre mode d'analyse : l'agent adapte les indicateurs, le vocabulaire et les visualisations à votre métier.":
    "Choose your analysis mode: the agent adapts KPIs, vocabulary and visualisations to your field.",
  "Visualisations intégrées : Recharts, Vega-Lite et Plotly (coupes, cartes, 3D, ternaires, chandeliers, heatmaps).":
    "Built-in visualisations: Recharts, Vega-Lite and Plotly (sections, maps, 3D, ternary, candlesticks, heatmaps).",
  "Tarifs simples": "Simple pricing",
  Gratuit: "Free",
  "{count} analyses offertes pour découvrir (une seule fois)":
    "{count} analyses included to get started (one-time)",
  "Fichiers jusqu'à {mb} Mo / {rows} lignes": "Files up to {mb} MB / {rows} rows",
  "Historique des conversations": "Conversation history",
  Commencer: "Get started",
  "Analyses illimitées": "Unlimited analyses",
  "Historique illimité": "Unlimited history",
  "Exports PDF et Excel": "PDF and Excel exports",
  "Devenir Pro": "Go Pro",
  "Tout Pro, sans compromis": "Everything in Pro, no compromise",
  "Découvrir Team": "Discover Team",
  "/mois": "/month",
  "Comparez les offres en détail sur la": "Compare the plans in detail on the",
  "page Tarifs": "Pricing page",
  "Analyse de données rigoureuse et pédagogue.": "Rigorous and pedagogical data analysis.",
  Contact: "Contact",
  Profilage: "Profiling",
  "Structure, qualité, valeurs manquantes et doublons passés au crible.":
    "Structure, quality, missing values and duplicates screened.",
  Préparation: "Preparation",
  "Nettoyage documenté, avec un journal de transformations vérifiable.":
    "Documented cleaning, with a verifiable transformation journal.",
  Exploration: "Exploration",
  "KPI, tendances, segments et anomalies mis en évidence.":
    "KPIs, trends, segments and anomalies highlighted.",
  Modélisation: "Modelling",
  "Approches prédictives simples quand elles apportent de la valeur.":
    "Simple predictive approaches when they add value.",
  Recommandations: "Recommendations",
  "Des conclusions chiffrées et des actions concrètes.":
    "Quantified conclusions and concrete actions.",
  "CA total": "Total revenue",
  Croissance: "Growth",
  "6 derniers mois": "Last 6 months",
  "Panier moyen": "Average basket",
  CA: "Revenue",
  "Évolution du chiffre d'affaires": "Revenue trend",
  Exemple: "Example",
  "{count} lignes analysées": "{count} rows analyzed",
  Recommandation: "Recommendation",
  "Concentrez vos efforts sur la région Sud : +18 % de CA et un panier moyen supérieur de 9 €.":
    "Focus your efforts on the South region: +18% revenue and a basket average €9 higher.",
  "Voir le détail": "View details",
  "Données fictives — exemple d'analyse.": "Fictional data — example analysis.",
  "Fichier original non conservé": "Original file not stored",
  "Analyse en 5 étapes visibles": "Visible 5-step analysis",
  "Sans carte bancaire pour commencer": "No credit card required to start",
  "Confiance et confidentialité": "Trust and privacy",
  "Questions fréquentes": "Frequently asked questions",
  "Les réponses essentielles avant de lancer votre première analyse.":
    "The key answers before your first analysis.",
  "Les 5 analyses gratuites, c'est par mois ?": "Are the 5 free analyses per month?",
  "Non. Les 5 analyses offertes sont valables une seule fois et ne se renouvellent pas chaque mois. Une fois le quota utilisé, il faut passer à Pro ou Team pour continuer.":
    "No. The 5 included analyses are one-time and do not renew each month. Once the quota is used, you need to upgrade to Pro or Team to continue.",
  "Quels formats de fichiers sont acceptés ?": "Which file formats are accepted?",
  "CSV, TSV, TXT, Excel (.xlsx et .xls), JSON, GeoJSON et LAS. Le fichier est lu dans votre navigateur avant l'analyse.":
    "CSV, TSV, TXT, Excel (.xlsx and .xls), JSON, GeoJSON and LAS. The file is read in your browser before the analysis.",
  "Mes données sont-elles conservées ?": "Is my data stored?",
  "Le fichier d'origine n'est jamais conservé. Pour réafficher votre jeu de données dans la conversation, nous gardons uniquement un aperçu des 40 premières lignes au format CSV, un résumé statistique (colonnes, types, valeurs manquantes) et les messages échangés. Vous pouvez supprimer la conversation depuis la barre latérale, ce qui supprime aussi cet historique. Évitez les données personnelles ou sensibles.":
    "The original file is never stored. To display your dataset again in the conversation, we keep only a preview of the first 40 rows in CSV format, a statistical summary (columns, types, missing values) and the messages exchanged. You can delete the conversation from the sidebar, which also removes this history. Avoid personal or sensitive data.",
  "Puis-je exporter mes résultats ?": "Can I export my results?",
  "Oui, en PDF et Excel, avec les offres Pro et Team. L'offre gratuite ne comprend pas les exports.":
    "Yes, as PDF and Excel, with Pro and Team plans. The free plan does not include exports.",
  "Comment résilier ?": "How do I cancel?",
  "Depuis la page Tarifs, le bouton « Gérer mon abonnement » ouvre le portail Stripe, où vous pouvez annuler le renouvellement.":
    "From the Pricing page, the “Manage my subscription” button opens the Stripe portal, where you can cancel the renewal.",
  "Mes données servent-elles à entraîner une IA ?": "Is my data used to train AI?",
  "Non. Datello ne réentraîne aucun modèle avec vos données. L'analyse est générée via":
    "No. Datello does not retrain any model with your data. The analysis is generated via",
  "à partir de votre question, de l'aperçu CSV et du résumé statistique. Le fichier d'origine n'est pas transmis. Évitez les données personnelles ou sensibles.":
    "from your question, the CSV preview and the statistical summary. The original file is not transmitted. Avoid personal or sensitive data.",
  "Comment vous contacter ?": "How can I contact you?",
  "Écrivez-nous à": "Email us at",
  "Nous répondons sous 48 heures ouvrées. Pour une suppression de compte, vous pouvez aussi nous écrire depuis cet email.":
    "We reply within 48 business hours. For account deletion, you can also write to us from this email.",
  "Mon espace": "My dashboard",
  "Essai gratuit": "Free trial",
  "Essayez gratuitement, passez à l’offre qui vous convient. Sans engagement.":
    "Try it free, then pick the plan that fits you. No commitment.",
  "Offre {plan} active à {count} analyses ce mois-ci":
    "Active {plan} plan — {count} analyses this month",
  "Essai : {used} / {limit} analyses utilisées": "Trial: {used} / {limit} analyses used",
  "Pas d'export": "No export",
  "Continuer l'essai": "Continue trial",
  "Commencer gratuitement": "Start for free",
  "Votre offre": "Your plan",
  Populaire: "Popular",
  "Gérer mon abonnement": "Manage my subscription",
  "Changer d’offre": "Change plan",
  "Redirection…": "Redirecting…",
  "Choisir {name}": "Choose {name}",
  "Renouvellement le {date}": "Renews on {date}",
  "Découvrir tous les avantages Pro": "Discover all Pro benefits",
  "Paiement sécurisé par Stripe. Annulation en un clic. Une question ?":
    "Secure payment via Stripe. Cancel in one click. A question?",
  "Contactez-nous": "Contact us",
  "Paiement confirmé ! Bienvenue dans votre nouvelle offre.":
    "Payment confirmed! Welcome to your new plan.",
  "Paiement annulé.": "Payment cancelled.",
  "Paiement indisponible.": "Payment unavailable.",
  "Portail indisponible.": "Portal unavailable.",
  "Tout le plan Pro": "Everything in the Pro plan",
  "Traitement prioritaire": "Priority processing",
  "Support dédié par email": "Dedicated email support",
  "E-commerçant, France": "E-commerce, France",
  "Consultant, Espagne": "Consulting, Spain",
  "Datello m'a fait économiser 10h d'analyse sur mes ventes.":
    "Datello saved me 10 hours of analysis on my sales.",
  "Enfin un outil qui explique mes CSV sans code.":
    "Finally a tool that explains my CSVs without code.",
  "L'export Excel est parfait pour mes rapports.": "Excel export is perfect for my reports.",
  "Comprendre la survie": "Understand survival",
  "Des lignes de passagers, des âges manquants et plusieurs classes.":
    "Rows of passengers, missing ages and several classes.",
  "Comparaison des groupes, contrôle des valeurs manquantes et limites de l'échantillon.":
    "Group comparison, missing-value checks and sample limits.",
  "Trouver les produits moteurs": "Find the top products",
  "Des commandes dispersées entre produits, dates et montants.":
    "Orders scattered across products, dates and amounts.",
  "Classement des ventes, évolution des revenus et recommandations commerciales.":
    "Sales ranking, revenue trends and sales recommendations.",
  "Comparer les campagnes": "Compare campaigns",
  "Des clics, des dépenses et des conversions difficiles à comparer.":
    "Clicks, spend and conversions hard to compare.",
  "Lecture des indicateurs par canal et identification des écarts à approfondir.":
    "Channel metrics readout and gaps to investigate.",
  "Groupe A": "Group A",
  "Groupe B": "Group B",
  "Groupe C": "Group C",
  "Produit A": "Product A",
  "Produit B": "Product B",
  "Produit C": "Product C",
  "Canal A": "Channel A",
  "Canal B": "Channel B",
  "Canal C": "Channel C",
  "Puis-je annuler à tout moment ?": "Can I cancel at any time?",
  "Oui. Depuis la page Tarifs, cliquez sur « Gérer mon abonnement » pour ouvrir le portail Stripe et annuler votre renouvellement, où que vous soyez.":
    "Yes. From the Pricing page, click “Manage my subscription” to open the Stripe portal and cancel your renewal, wherever you are.",
  "Mon CSV est-il sécurisé ?": "Is my CSV secure?",
  "Vos conversations sont liées à votre compte et leur accès est protégé. Le fichier original n'est pas conservé : un extrait CSV est enregistré avec votre conversation. Il n'est pas supprimé automatiquement après l'analyse ; vous pouvez supprimer la conversation. Évitez les données personnelles ou sensibles.":
    "Your conversations are linked to your account and their access is protected. The original file is not stored: a CSV extract is saved with your conversation. It is not deleted automatically after analysis; you can delete the conversation. Avoid personal or sensitive data.",
  "Ça marche pour les gros fichiers ?": "Does it work with large files?",
  "L'essai gratuit accepte jusqu'à 5 Mo et 50 000 lignes ; Pro jusqu'à 100 Mo et 500 000 lignes ; Team jusqu'à 250 Mo et 2 000 000 de lignes. Le profil statistique est calculé sur l'intégralité du fichier, avec un échantillonnage régulier au-delà de 200 000 lignes.":
    "Free trial accepts up to 5 MB and 50,000 rows; Pro up to 100 MB and 500,000 rows; Team up to 250 MB and 2,000,000 rows. The statistical profile is computed on the complete file, with regular sampling beyond 200,000 rows.",
  "Puis-je payer depuis l'étranger ?": "Can I pay from abroad?",
  "Le paiement est traité par Stripe. Les cartes et moyens de paiement proposés dépendent du pays, de votre appareil et de la configuration du compte Stripe. Les options disponibles apparaissent avant de payer.":
    "Payment is processed by Stripe. Cards and payment methods offered depend on your country, device and Stripe account configuration. Available options appear before you pay.",
  "Puis-je obtenir un remboursement ?": "Can I get a refund?",
  "Annuler empêche les prochains renouvellements. Cela ne déclenche pas automatiquement un remboursement ; toute demande dépend des conditions applicables et des droits légaux de votre pays.":
    "Cancelling prevents future renewals. It does not automatically trigger a refund; any request depends on applicable terms and your country's legal rights.",
  "L'essai gratuit est-il toujours inclus ?": "Is the free trial always included?",
  "Oui, vous pouvez commencer avec 5 analyses gratuites sans carte bancaire. Pro est un abonnement à 19 €/mois dès la souscription ; le paiement affiche le montant avant confirmation. Les exports PDF et Excel sont inclus dans Pro.":
    "Yes, you can start with 5 free analyses, no credit card required. Pro is a €19/month subscription from sign-up; payment shows the amount before confirmation. PDF and Excel exports are included in Pro.",
  "Passez en Pro": "Go Pro",
  "Annulable partout dans le monde.": "Cancel anywhere in the world.",
  "Des questions aux décisions. Multipliez vos analyses, comparez vos résultats et partagez des rapports prêts pour votre équipe.":
    "From questions to decisions. Multiply your analyses, compare your results and share reports ready for your team.",
  "Devenir Pro — Essai toujours inclus": "Go Pro — free trial always included",
  "Sans engagement": "No commitment",
  "Paiement sécurisé Stripe": "Stripe secure payment",
  "Annulation en ligne": "Cancel online",
  "Votre prochain niveau": "Your next level",
  "Gratuit pour essayer. Pro pour avancer.": "Free to try. Pro to move forward.",
  Inclus: "Included",
  "Pro à 19 €/mois": "Pro — €19/month",
  Analyses: "Analyses",
  "{count} offertes": "{count} included",
  Illimitées: "Unlimited",
  "Taille du fichier": "File size",
  "Lignes par fichier": "Rows per file",
  Rapports: "Reports",
  Oui: "Yes",
  "Datello profile l'intégralité de votre fichier (échantillonnage régulier au-delà de 200 000 lignes) et détecte les vides, doublons, valeurs non numériques et valeurs aberrantes. L'offre Pro augmente les limites et débloque les exports. Besoin de fichiers plus volumineux ?":
    "Datello profiles your entire file (regular sampling beyond 200,000 rows) and detects gaps, duplicates, non-numeric and outlier values. Pro raises the limits and unlocks exports. Need bigger files?",
  "L'offre Team (49 €/mois)": "The Team plan (€49/month)",
  "monte à 250 Mo et 2 000 000 de lignes.": "goes up to 250 MB and 2,000,000 rows.",
  "Du CSV brut à une lecture claire.": "From raw CSV to clear reading.",
  "Trois exemples illustratifs. Les graphiques ci-dessous ne sont pas des résultats calculés sur vos fichiers.":
    "Three illustrative examples. The charts below are not results computed from your files.",
  AVANT: "BEFORE",
  APRÈS: "AFTER",
  "Leurs mots, votre prochain déclic.": "Their words, your next click.",
  "Témoignages fournis par Datello.": "Testimonials provided by Datello.",
  "5 étoiles sur 5": "5 stars out of 5",
  "Vos questions, sans détour.": "Your questions, straight to the point.",
  "Datello Pro. À vous de décider.": "Datello Pro. The call is yours.",
  "19 €/mois. Analyses illimitées. Rapports PDF et Excel.":
    "€19/month. Unlimited analyses. PDF and Excel reports.",
  "L'essai gratuit de 5 analyses reste disponible avant de souscrire.":
    "The 5 free analyses remain available before you subscribe.",
  "Datello — Vos données, vos décisions.": "Datello — Your data, your decisions.",
  "Retour aux tarifs": "Back to pricing",
  "Chargement de la conversation…": "Loading the conversation…",
  "Les exports PDF et Excel sont inclus dans Pro.": "PDF and Excel exports are included in Pro.",
  "Rapport exporté.": "Report exported.",
  "Export impossible. Réessayez.": "Export failed. Try again.",
  "Le fichier doit contenir un en-tête et au moins une ligne valide.":
    "The file must contain a header and at least one valid row.",
  "Fichier « {name} » chargé : {summary} analysées.": "File {name} loaded: {summary} analyzed.",
  "Votre offre accepte les fichiers jusqu’à {mb} Mo. Passez à l’offre supérieure pour les fichiers plus volumineux.":
    "Your plan accepts files up to {mb} MB. Upgrade to a higher plan for larger files.",
  "Voir les offres": "View plans",
  "Votre offre accepte jusqu’à {max} lignes ; ce fichier en contient {count}. Passez à l’offre supérieure pour les fichiers plus volumineux.":
    "Your plan accepts up to {max} rows; this file contains {count}. Upgrade to a higher plan for larger files.",
  "Lecture du fichier Excel impossible. Vérifiez qu’il n’est pas protégé.":
    "Could not read the Excel file. Make sure it is not protected.",
  "Lecture du fichier JSON/GeoJSON impossible. Vérifiez sa structure.":
    "Could not read the JSON/GeoJSON file. Check its structure.",
  "Lecture du fichier LAS impossible. Vérifiez les sections ~C et ~A.":
    "Could not read the LAS file. Check sections ~C and ~A.",
  "Lecture du fichier impossible. Utilisez un CSV valide.":
    "Could not read the file. Use a valid CSV.",
  "Exporter le rapport PDF — Pro": "Export PDF report — Pro",
  "Exporter le rapport Excel — Pro": "Export Excel report — Pro",
  "Remplacer le fichier": "Replace the file",
  "Téléverser un fichier": "Upload a file",
  "Passer à Pro": "Go Pro",
  "Aucun fichier associé — téléversez un fichier pour analyser vos données.":
    "No file attached — upload a file to analyze your data.",
  "Que voulez-vous analyser ?": "What would you like to analyze?",
  "Téléversez un fichier (CSV, Excel, JSON, GeoJSON, LAS…), puis posez votre question métier.":
    "Upload a file (CSV, Excel, JSON, GeoJSON, LAS…), then ask your business question.",
  "Analyse en cours…": "Analysis in progress…",
  "Posez votre question sur vos données…": "Ask your question about your data…",
  "Datello s’appuie sur le profil statistique complet du fichier et un échantillon d’illustration. Vérifiez les chiffres clés.":
    "Datello relies on the complete statistical profile of the file and an illustrative sample. Check the key figures.",
  "Exemples : {list}": "Examples: {list}",
  "Chargement du graphique…": "Loading the chart…",
  "{measures} par {x}": "{measures} by {x}",
  "{y} par {x}": "{y} by {x}",
  "Distribution de {field}": "Distribution of {field}",
  "Colonne {n}": "Column {n}",
  Valeur: "Value",
  Catégorie: "Category",
  "{numeric} moyen par {category}": "Average {numeric} by {category}",
  "Source : colonne {label} du fichier, agrégée par {by}.":
    "Source: column {label} from the file, aggregated by {by}.",
  "nombre de lignes": "row count",
  "Graphique généré automatiquement à partir du fichier.":
    "Chart generated automatically from the file.",
  Graphique: "Chart",
  "Graphique statistique": "Statistical chart",
  "Visualisation scientifique": "Scientific visualization",
  "{count} cellule(s) vide(s)": "{count} empty cell(s)",
  "imputation ou suppression": "imputation or removal",
  "{count} ligne(s) dupliquée(s)": "{count} duplicate row(s)",
  dédoublonnage: "deduplication",
  "{count} valeur(s) non numérique(s) en colonne numérique":
    "{count} non-numeric value(s) in a numeric column",
  "conversion ou correction": "conversion or correction",
  "{count} valeur(s) aberrante(s) (IQR 1,5)": "{count} outlier(s) (IQR 1.5)",
  "vérification, plafonnement ou retrait": "review, capping or removal",
  "{count} colonne(s) constante(s)": "{count} constant column(s)",
  "sans pouvoir discriminant": "no discriminating power",
  "{count} valeur(s) avec espaces parasites": "{count} value(s) with stray spaces",
  "nettoyage des espaces": "whitespace cleanup",
  Lignes: "Rows",
  Colonnes: "Columns",
  "Valeurs vides": "Empty values",
  Doublons: "Duplicates",
  "Qualité des données": "Data quality",
  "Détection sur {sampled} lignes échantillonnées sur {total}.":
    "Detected on {sampled} sampled rows out of {total}.",
  "Détection sur {total} lignes.": "Detected on {total} rows.",
  "Aucun problème majeur détecté.": "No major issue detected.",
  "L'agent explique chaque problème et propose une correction sans modifier vos données.":
    "The agent explains each issue and suggests a fix without modifying your data.",
  "Distributions (fichier complet)": "Distributions (full file)",
  valeurs: "values",
  "Corrélations (Pearson)": "Correlations (Pearson)",
  "Données insuffisantes": "Insufficient data",
  "Bleu = corrélation positive, rouge = négative. Calcul sur les lignes complètes (jusqu'à 50 000).":
    "Blue = positive correlation, red = negative. Computed on complete rows (up to 50,000).",
  "{type} · {count} vides": "{type} · {count} empty",
  "Fichier prêt": "File ready",
  "Téléversement & lecture du fichier « {name} »…": "Uploading & reading the file {name}…",
  "Téléversement & lecture du fichier…": "Uploading & reading the file…",
  "Progression du téléversement": "Upload progress",
  "Lecture et profilage du fichier (CSV, Excel, JSON, GeoJSON, LAS).":
    "Reading and profiling the file (CSV, Excel, JSON, GeoJSON, LAS).",
  "Progression estimée de l’analyse": "Estimated analysis progress",
  "Analyse en cours, cela peut prendre 30s pour les gros fichiers":
    "Analysis in progress, this can take 30s for large files",
  "Upload du CSV": "CSV upload",
  "Lecture & parsing du fichier": "Reading & parsing the file",
  "Analyse par l’IA": "AI analysis",
  "Génération des graphiques": "Generating charts",
  "Graphique indisponible pour ces données.": "Chart unavailable for this data.",
  "Impossible de créer la conversation.": "Could not create the conversation.",
  "Supprimer cette conversation et son historique ? Cette action est définitive.":
    "Delete this conversation and its history? This action is permanent.",
  "Suppression impossible.": "Deletion failed.",
  "Votre compte a été supprimé.": "Your account has been deleted.",
  "Nouvelle analyse": "New analysis",
  "Supprimer la conversation": "Delete conversation",
  "Aucune conversation. Lancez votre première analyse !":
    "No conversations yet. Start your first analysis!",
  Actif: "Active",
  "{used} / {limit} analyses utilisées": "{used} / {limit} analyses used",
  "Passer à Pro — analyses illimitées": "Go Pro — unlimited analyses",
  Administration: "Administration",
  "Offres / Abonnement": "Plans / Subscription",
  "Connecté :": "Signed in:",
  "Aide / Contact": "Help / Contact",
  "Se déconnecter / changer de compte": "Sign out / switch account",
  "Supprimer mon compte": "Delete my account",
  "Cette action est définitive.": "This action is permanent.",
  "Votre abonnement Stripe actif sera résilié immédiatement. Tapez SUPPRIMER pour confirmer.":
    "Your active Stripe subscription will be canceled immediately. Type SUPPRIMER to confirm.",
  "Confirmation de suppression du compte": "Account deletion confirmation",
  "Suppression…": "Deleting…",
  Confirmer: "Confirm",
  Annuler: "Cancel",
  "Connectez-vous avec le compte administrateur.": "Sign in with the administrator account.",
  "Accès réservé à l’administrateur.": "Access restricted to the administrator.",
  "Remettre à zéro le compteur d’analyses de {email} ?": "Reset the analysis counter for {email}?",
  "Compteur de {email} remis à zéro.": "Counter for {email} reset.",
  "Réinitialisation impossible.": "Reset failed.",
  "retirer l’offre de": "remove the plan from",
  "offrir {plan} à": "offer {plan} to",
  "Voulez-vous {label} {email} ?": "Do you want to {label} {email}?",
  "Offre retirée à {email}.": "Plan removed from {email}.",
  "{plan} offert à {email}.": "{plan} offered to {email}.",
  "Mise à jour de l’offre impossible.": "Could not update the plan.",
  "{delta} analyses pour {email}.": "{delta} analyses for {email}.",
  "Mise à jour du quota impossible.": "Could not update the quota.",
  "Retirer les droits admin de {email} ?": "Remove admin rights from {email}?",
  "Donner les droits admin à {email} ?": "Grant admin rights to {email}?",
  "{email} n’est plus administrateur.": "{email} is no longer an administrator.",
  "{email} est désormais administrateur.": "{email} is now an administrator.",
  "Action impossible.": "Action failed.",
  "Utilisateurs, abonnements et activité de Datello.": "Datello users, subscriptions and activity.",
  Actualiser: "Refresh",
  "Retour à l’espace": "Back to workspace",
  "Chargement…": "Loading…",
  Utilisateurs: "Users",
  "Abonnés Pro / Team": "Pro / Team subscribers",
  "Revenu mensuel estimé": "Estimated monthly revenue",
  "Analyses aujourd’hui": "Analyses today",
  Conversations: "Conversations",
  "Analyses au total": "Analyses in total",
  "Gratuits proches de la limite": "Free users near the limit",
  "Analyses (14 jours)": "Analyses (14 days)",
  "Analyses par jour (14 derniers jours)": "Analyses per day (last 14 days)",
  Trafic: "Traffic",
  "Dernières analyses": "Latest analyses",
  "Rechercher un email…": "Search an email…",
  Tous: "All",
  "Exporter CSV": "Export CSV",
  Email: "Email",
  Offre: "Plan",
  "30 j": "30 d",
  "Conv.": "Conv.",
  Inscrit: "Signed up",
  Connexion: "Last sign-in",
  offert: "comped",
  Actions: "Actions",
  "Offrir Pro": "Offer Pro",
  "Offrir Team": "Offer Team",
  "Retirer l’offre offerte": "Remove comped plan",
  "Quota d’analyses": "Analysis quota",
  "Ajouter 5 analyses": "Add 5 analyses",
  "Retirer 5 analyses": "Remove 5 analyses",
  "Remettre à zéro": "Reset",
  Droits: "Rights",
  "Retirer admin": "Remove admin",
  "Rendre admin": "Make admin",
  "Aucun utilisateur.": "No users.",
  "Visites (30 j)": "Visits (30 d)",
  "Visites aujourd'hui": "Visits today",
  "Pays détectés": "Countries detected",
  visites: "visits",
  "Aucune visite géolocalisée pour le moment. Les visites sont comptées sans cookie ni adresse IP, à partir du pays fourni par le réseau.":
    "No geolocated visits yet. Visits are counted without cookies or IP addresses, using the country provided by the network.",
  "Visites par jour (14 derniers jours)": "Visits per day (last 14 days)",
  Pays: "Country",
  Visites: "Visits",
  Inconnu: "Unknown",
  "Aucune visite.": "No visits.",
  "Mesure d'audience sans cookie : seul le pays transmis par le réseau, la page et le référent sont enregistrés. Aucune adresse IP ni donnée personnelle n'est stockée.":
    "Cookie-free audience measurement: only the network-provided country, page and referrer are recorded. No IP address or personal data is stored.",
  Utilisateur: "User",
  Conversation: "Conversation",
  Fichier: "File",
  "Mise à jour": "Updated",
  "Paiements, factures et remboursements : tableau de bord Stripe. Le revenu affiché est une estimation à partir des abonnements actifs.":
    "Payments, invoices and refunds: Stripe dashboard. The revenue shown is an estimate based on active subscriptions.",
  "Vérification de votre session…": "Checking your session…",
  "Ouverture de votre espace d'analyse…": "Opening your analysis space…",
  "Fichiers jusqu’à {mb} Mo / {rows} lignes": "Files up to {mb} MB / {rows} rows",
  "Compte créé ! Vérifiez votre email pour confirmer votre inscription.":
    "Account created! Check your email to confirm your sign-up.",
  "Email ou mot de passe incorrect. Si vous vous êtes inscrit avec Google, utilisez « Continuer avec Google ».":
    "Incorrect email or password. If you signed up with Google, use “Continue with Google”.",
  "Confirmez d'abord votre email via le lien reçu.":
    "First confirm your email via the link you received.",
  "Un compte existe déjà avec cet email. Connectez-vous (ou utilisez Google).":
    "An account already exists with this email. Sign in (or use Google).",
  "Une erreur est survenue.": "An error occurred.",
  "Renseignez d'abord votre adresse email, puis cliquez à nouveau.":
    "Enter your email address first, then click again.",
  "Email de réinitialisation envoyé. Vérifiez votre boîte de réception.":
    "Reset email sent. Check your inbox.",
  "Envoi impossible. Réessayez dans un instant.": "Could not send. Try again in a moment.",
  "Mot de passe mis à jour.": "Password updated.",
  "Mise à jour impossible.": "Update failed.",
  "La connexion Google n'est disponible que sur le site Lovable (preview ou publié). En local, utilisez email + mot de passe.":
    "Google sign-in is only available on the Lovable site (preview or published). Locally, use email + password.",
  "La connexion Google a échoué.": "Google sign-in failed.",
  "Nouveau mot de passe": "New password",
  "Bon retour": "Welcome back",
  "Créer un compte": "Create an account",
  "Choisissez un nouveau mot de passe pour votre compte.":
    "Choose a new password for your account.",
  "Connectez-vous pour retrouver vos analyses.": "Sign in to access your analyses.",
  "5 analyses offertes, sans carte bancaire.": "5 analyses included, no credit card required.",
  "Nouveau mot de passe (6 caractères min.)": "New password (min. 6 characters)",
  "Patientez…": "Please wait…",
  "Mettre à jour le mot de passe": "Update password",
  "Continuer avec Google": "Continue with Google",
  ou: "or",
  "Adresse email": "Email address",
  "Mot de passe (6 caractères min.)": "Password (min. 6 characters)",
  "S'inscrire": "Sign up",
  "Email envoyé — renvoyer le lien": "Email sent — resend link",
  "Mot de passe oublié ?": "Forgot password?",
  "Pas encore de compte ?": "No account yet?",
  "Déjà inscrit ?": "Already signed up?",
  "Marketing, UK": "Marketing, UK",
  Historique: "History",
  Pro: "Pro",
  Team: "Team",
};

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a French UI string into the current language. Optional {token} interpolation. */
  t: (source: string, vars?: Record<string, string | number>) => string;
  /** Locale for Intl.NumberFormat / toLocaleDateString, e.g. "fr-FR" | "en-US". */
  locale: string;
};

const LangContext = createContext<LangContextValue>({
  lang: "fr",
  setLang: () => {},
  t: (s) => s,
  locale: "fr-FR",
});

function detectInitialLang(): Lang {
  if (typeof navigator === "undefined") return "fr";
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const isFrench = langs.some((value) => value?.toLowerCase().startsWith("fr"));
  return isFrench ? "fr" : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    let initial: Lang | null = null;
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "fr" || saved === "en") initial = saved;
    } catch {
      /* stockage indisponible */
    }
    if (!initial) initial = detectInitialLang();
    setLangState(initial);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* stockage indisponible */
    }
  };

  const translate: LangContextValue["t"] = (source, vars) => {
    let out = lang === "en" ? (EN[source] ?? source) : source;
    if (vars) {
      for (const key of Object.keys(vars)) {
        out = out.split(`{${key}}`).join(String(vars[key]));
      }
    }
    return out;
  };

  const value: LangContextValue = {
    lang,
    setLang,
    t: translate,
    locale: lang === "en" ? "en-US" : "fr-FR",
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function localeOf(lang: Lang): string {
  return lang === "en" ? "en-US" : "fr-FR";
}
