// Datello — textes des différents moments de l'app (français + anglais)
// Chaque moment indique l'expression de la mascotte à afficher.
// Les {accolades} sont des variables à remplacer dans le code.

export const moments = {
  accueil: {
    mood: "bonjour",
    fr: {
      titre: "Bonjour ! Quelles données on regarde aujourd'hui ?",
      sousTitre: "Importez un fichier (CSV, Excel) ou posez directement votre question.",
      suggestions: [
        "Quels produits se vendent le mieux ?",
        "Résume ce fichier en 5 points",
        "Montre l'évolution des ventes par mois",
      ],
    },
    en: {
      titre: "Hi! What data are we looking at today?",
      sousTitre: "Upload a file (CSV, Excel) or just ask your question.",
      suggestions: [
        "Which products sell best?",
        "Summarise this file in 5 points",
        "Show sales by month",
      ],
    },
  },
  importEnCours: {
    mood: "reflechit",
    fr: { texte: "Je lis votre fichier « {fichier} »…" },
    en: { texte: "Reading your file “{fichier}”…" },
  },
  fichierPret: {
    mood: "trouve",
    fr: { texte: "C'est bon ! J'ai trouvé {lignes} lignes et {colonnes} colonnes. Que voulez-vous savoir ?" },
    en: { texte: "All set! I found {lignes} rows and {colonnes} columns. What would you like to know?" },
  },
  nettoyage: {
    mood: "reflechit",
    fr: { texte: "Je nettoie vos données : doublons, cases vides, formats de dates…" },
    en: { texte: "Cleaning your data: duplicates, empty cells, date formats…" },
  },
  analyse: {
    mood: "reflechit",
    fr: { texte: "J'analyse vos données…", etapes: ["Je lis la question", "Je calcule", "Je prépare le graphique"] },
    en: { texte: "Analysing your data…", etapes: ["Reading the question", "Calculating", "Building the chart"] },
  },
  resultat: {
    mood: "trouve",
    fr: { texte: "Voilà ce que j'ai trouvé !", actions: ["Comparer à la période précédente", "Exporter le graphique", "Ajouter au tableau de bord"] },
    en: { texte: "Here's what I found!", actions: ["Compare with previous period", "Export chart", "Add to dashboard"] },
  },
  erreurFichier: {
    mood: "oups",
    fr: { texte: "Oups, je n'arrive pas à lire ce fichier. Vérifiez qu'il s'agit bien d'un CSV ou d'un Excel, puis réessayez.", bouton: "Réessayer" },
    en: { texte: "Oops, I can't read this file. Check it's a CSV or Excel file, then try again.", bouton: "Try again" },
  },
  questionFloue: {
    mood: "oups",
    fr: { texte: "Je ne suis pas sûr de comprendre. Vous parlez de quelle colonne : {suggestions} ?" },
    en: { texte: "I'm not sure I follow. Which column do you mean: {suggestions}?" },
  },
  donneesManquantes: {
    mood: "oups",
    fr: { texte: "Il manque des données pour répondre : la colonne « {colonne} » est vide sur {pourcentage} des lignes." },
    en: { texte: "Some data is missing: the “{colonne}” column is empty in {pourcentage} of rows." },
  },
  horsLigne: {
    mood: "oups",
    fr: { texte: "La connexion a été coupée. Vos données sont en sécurité, on reprend dès que c'est revenu." },
    en: { texte: "Connection lost. Your data is safe, we'll pick up as soon as it's back." },
  },
} as const;

export const slogans = {
  principal: { fr: "Vos données, enfin claires.", en: "Your data, finally clear." },
  autres: [
    { fr: "Posez la question. Datello trouve la réponse.", en: "Ask the question. Datello finds the answer." },
    { fr: "Des données brutes aux idées claires.", en: "Raw data in. Clear answers out." },
    { fr: "Votre analyste de données, toujours prêt.", en: "Your data analyst, always on." },
    { fr: "De vos chiffres à vos décisions.", en: "From numbers to decisions." },
  ],
};
