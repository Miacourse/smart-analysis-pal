export type AnalysisDomainId =
  | "general"
  | "geophysics"
  | "geochemistry"
  | "geology"
  | "environment"
  | "marketing"
  | "finance"
  | "healthcare"
  | "logistics"
  | "energy"
  | "agriculture"
  | "industry"
  | "hr"
  | "education"
  | "research"
  | "sports"
  | "real-estate"
  | "insurance"
  | "telecom"
  | "public-sector";

export interface AnalysisDomain {
  id: AnalysisDomainId;
  label: string;
  description: string;
  prompt: string;
  examples: string[];
}

export const ANALYSIS_DOMAINS: AnalysisDomain[] = [
  {
    id: "general",
    label: "Généraliste",
    description: "Toute donnée tabulaire : ventes, opérations, enquêtes, fichiers métier.",
    prompt:
      "Mode GÉNÉRALISTE.\n- Adopte les KPI, unités et vocabulaire du métier détectés dans les colonnes.\n- Priorise : qualité des données, tendances, segments, corrélations, anomalies, recommandations.\n- Graphiques : recharts pour comparer, vega pour les distributions, plotly pour cartes/sections/3D.",
    examples: [
      "Quels sont les principaux indicateurs et tendances ?",
      "Quels segments ou anomalies ressortent ?",
      "Quelles actions concrètes recommandes-tu ?",
    ],
  },
  {
    id: "geophysics",
    label: "Géophysique",
    description: "Tomographie électrique, sismique, gravimétrie, magnétisme, GPR.",
    prompt:
      'Mode GÉOPHYSIQUE (tomographie électrique, sismique, gravimétrie, magnétisme, GPR).\n- Respecte les unités et conventions : résistivité Ω·m (souvent log10), vitesse m/s, temps s/ms, amplitude, champ nT, anomalie de Bouguer mGal, profondeur m.\n- Distingue mesures brutes, corrections, modèles inversés et incertitudes ; ne prétends pas réaliser une inversion ou un traitement lourd.\n- Visualisations : pseudo-section ERT -> plotly heatmap (x=distance, y=profondeur inversée, z=log10(résistivité), colorscale "Turbo") ; section sismique -> heatmap (y=temps inversé, z=amplitude, "RdBu", zmid=0) ; cartes gravimétrie/magnétisme -> contour ou scattergeo (lat/lon, couleur=anomalie) ; volume 3D -> surface ou mesh3d.\n- Vérifie coordonnées, pas d\'échantillonnage, répétitions et bruit avant de conclure.',
    examples: [
      "Analyse cette pseudo-section ERT : où sont les zones conductrices ?",
      "Compare les amplitudes le long du profil sismique.",
      "Cartographie les anomalies magnétiques par station.",
    ],
  },
  {
    id: "geochemistry",
    label: "Géochimie",
    description: "Roches, sols, eaux, exploration minière, éléments majeurs et traces.",
    prompt:
      "Mode GÉOCHIMIE (roches, sols, eaux, exploration).\n- Gère les limites de détection (<, ND), les substitutions et la fermeture compositionnelle ; log-transforme les éléments traces.\n- Utilise les ratios et indices pertinents (SiO2, Al2O3, CIA, Eu/Eu*, anomalies normalisées) et précise la référence de normalisation.\n- Graphiques : ternaires (QAP, ACF) via plotly scatterternary ; spider/terres rares via vega line en échelle log ; corrélations via scatter ; cartes via scattergeo.",
    examples: [
      "Classe ces échantillons dans un diagramme QAP.",
      "Quelles corrélations entre éléments majeurs et traces ?",
      "Trace les spectres de terres rares normalisés.",
    ],
  },
  {
    id: "geology",
    label: "Géologie",
    description: "Lithologie, stratigraphie, structures, cartes et coupes.",
    prompt:
      "Mode GÉOLOGIE.\n- Respecte lithologie, stratigraphie, pendage, direction, âges et unités ; distingue observations et interprétations.\n- Graphiques : cartes géologiques -> scattergeo/contour ; coupes -> heatmap ou area ; stéréonets et rosaces -> barpolar (données directionnelles) ; logs -> line par profondeur.",
    examples: [
      "Décris la succession stratigraphique de ce forage.",
      "Trace une coupe géologique à partir des sondages.",
      "Analyse les directions de fracturation (rosace).",
    ],
  },
  {
    id: "environment",
    label: "Environnement",
    description: "Eau, air, sol, biodiversité, climat et conformité réglementaire.",
    prompt:
      "Mode ENVIRONNEMENT (eau, air, sol, biodiversité, climat).\n- Compare aux seuils réglementaires, calcule les dépassements, tendances, saisonnalité et incertitudes ; cite la norme utilisée.\n- Graphiques : séries temporelles (line/area), dépassements (bar), stations (scattergeo), heatmap temporelle.",
    examples: [
      "Quels paramètres dépassent les seuils réglementaires ?",
      "Montre la tendance saisonnière de la qualité de l'eau.",
      "Cartographie les stations et leur niveau de pollution.",
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Ventes, conversion, CAC/LTV, cohortes, campagnes et attribution.",
    prompt:
      "Mode MARKETING / CRO.\n- KPI : CA, marge, conversion, CAC, LTV, churn, panier moyen, ROAS, attribution ; précise période et devise.\n- Graphiques : funnel (plotly funnel), cohortes (heatmap), séries (line), segments (bar), dispersion (scatter).",
    examples: [
      "Où se perd la conversion dans mon funnel ?",
      "Quels canaux ont le meilleur ROAS ?",
      "Compare la LTV par cohorte d'acquisition.",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    description: "P&L, trésorerie, budget vs réel, variances, marchés.",
    prompt:
      "Mode FINANCE / COMPTABILITÉ.\n- KPI : revenus, marges, EBITDA, cash-flow, budget vs réel, variance, aging, ratios ; précise devise, période et base (HT/TTC).\n- Graphiques : chandelier (plotly candlestick), waterfall, séries (line), variance (bar), distribution (box/violin).",
    examples: [
      "Explique l'écart budget vs réel par poste.",
      "Quelle est l'évolution de la trésorerie ?",
      "Trace un waterfall des variations de marge.",
    ],
  },
  {
    id: "healthcare",
    label: "Santé",
    description: "Épidémiologie, parcours de soins, qualité, coûts de santé.",
    prompt:
      "Mode SANTÉ / ÉPIDÉMIOLOGIE.\n- KPI : incidence, prévalence, sensibilité/spécificité, VPP/VPN, survie, délais, coûts ; rappelle les limites causales et la confidentialité.\n- Graphiques : courbes épidémiques (line), Kaplan-Meier (step), box/violin, heatmaps.",
    examples: [
      "Quelle est l'évolution de l'incidence par semaine ?",
      "Compare la survie entre les groupes de traitement.",
      "Analyse les délais de prise en charge.",
    ],
  },
  {
    id: "logistics",
    label: "Logistique",
    description: "Supply chain, stocks, OTIF, tournées et transport.",
    prompt:
      "Mode LOGISTIQUE / SUPPLY CHAIN.\n- KPI : OTIF, lead time, stock, rotation, taux de service, coût/km, ruptures.\n- Graphiques : cartes (scattergeo), flux (bar), séries (line), heatmap entrepôts×périodes.",
    examples: [
      "Quels entrepôts ont le plus de ruptures ?",
      "Analyse les retards de livraison par transporteur.",
      "Cartographie les tournées et les points de livraison.",
    ],
  },
  {
    id: "energy",
    label: "Énergie",
    description: "Production, consommation, réseau, rendement et décarbonation.",
    prompt:
      "Mode ÉNERGIE.\n- KPI : production, consommation, capacité, facteur de charge, rendement, intensité carbone ; unités kWh/MWh/GWh.\n- Graphiques : courbes de charge (line/area), mix (pie/bar), heatmap horaire, cartes d'installations.",
    examples: [
      "Trace la courbe de charge typique par heure.",
      "Quel est le mix de production et son évolution ?",
      "Où sont les pertes de rendement ?",
    ],
  },
  {
    id: "agriculture",
    label: "Agriculture",
    description: "Rendements, parcelles, intrants, météo et agroécologie.",
    prompt:
      "Mode AGRICULTURE / AGRO.\n- KPI : rendement t/ha, intrants, marge, humidité, précipitations, NDVI, parcelles.\n- Graphiques : séries agro-climatiques (line), cartes parcellaires (scattergeo), heatmap sol/culture, scatter rendement×intrant.",
    examples: [
      "Quels facteurs expliquent les écarts de rendement ?",
      "Compare rendement et précipitations par parcelle.",
      "Cartographie les parcelles et leur rendement.",
    ],
  },
  {
    id: "industry",
    label: "Industrie",
    description: "OEE/TRS, qualité, SPC, maintenance et défauts.",
    prompt:
      "Mode INDUSTRIE / QUALITÉ.\n- KPI : OEE, TRS, taux de défauts, MTBF/MTTR, capabilité, SPC, Pareto.\n- Graphiques : cartes de contrôle (line + limites), Pareto (bar+line), box/violin, heatmap machines×temps.",
    examples: [
      "Quelles machines limitent le TRS ?",
      "Trace une carte de contrôle et détecte les dérives.",
      "Quels défauts concentrent le plus d'impact (Pareto) ?",
    ],
  },
  {
    id: "hr",
    label: "Ressources humaines",
    description: "Effectifs, turnover, absentéisme, masse salariale, engagement.",
    prompt:
      "Mode RH.\n- KPI : effectif, turnover, absentéisme, masse salariale, ancienneté, engagement ; anonymise les personnes.\n- Graphiques : bar/line, distribution, heatmap service×mois.",
    examples: [
      "Quels services ont le turnover le plus élevé ?",
      "Analyse l'absentéisme par mois et par équipe.",
      "Quelle est l'évolution de la masse salariale ?",
    ],
  },
  {
    id: "education",
    label: "Éducation",
    description: "Résultats, progression, assiduité, cohortes et compétences.",
    prompt:
      "Mode ÉDUCATION.\n- KPI : réussite, progression, assiduité, taux de passage, effets de cohorte ; distingue note et compétence.\n- Graphiques : bar/line, distribution (box/violin), heatmap élèves×matières.",
    examples: [
      "Quelles matières posent le plus de difficulté ?",
      "Compare la progression des cohortes.",
      "Analyse le lien entre assiduité et réussite.",
    ],
  },
  {
    id: "research",
    label: "Recherche",
    description: "Statistiques, protocoles, distributions, tests et corrélations.",
    prompt:
      "Mode RECHERCHE / STATISTIQUES.\n- Décris hypothèses, taille d'échantillon, tests, intervalles de confiance et tailles d'effet ; ne confonds pas corrélation et causalité.\n- Graphiques : box/violin, scatter avec tendance, histogrammes/densité (vega), heatmap de corrélation.",
    examples: [
      "Quelles variables sont corrélées et dans quelle mesure ?",
      "Compare les distributions entre groupes.",
      "Y a-t-il un effet significatif après contrôle des covariables ?",
    ],
  },
  {
    id: "sports",
    label: "Sport",
    description: "Performance, charge d'entraînement, blessures, matchs.",
    prompt:
      "Mode SPORT / PERFORMANCE.\n- KPI : performance, charge, vitesse, distance, fréquence cardiaque, disponibilité, blessures.\n- Graphiques : séries temporelles, radars (barpolar/scatterpolar), comparaison (bar), heatmap matchs×métriques.",
    examples: [
      "Analyse la charge d'entraînement et le risque de blessure.",
      "Compare les profils physiques des joueurs.",
      "Quelles métriques distinguent les matchs gagnés ?",
    ],
  },
  {
    id: "real-estate",
    label: "Immobilier",
    description: "Prix, rendements, vacance, DPE et géographie.",
    prompt:
      "Mode IMMOBILIER.\n- KPI : prix/m², rendement locatif, vacance, DPE, délais de vente, géographie.\n- Graphiques : cartes (scattergeo/choropleth via plotly), séries de prix (line), distribution (box), bar par segment.",
    examples: [
      "Quels quartiers offrent le meilleur rendement ?",
      "Analyse l'évolution des prix au m².",
      "Cartographie les biens et leurs performances.",
    ],
  },
  {
    id: "insurance",
    label: "Assurance",
    description: "Sinistralité, primes, loss ratio, provisions et risques.",
    prompt:
      "Mode ASSURANCE.\n- KPI : sinistralité, fréquence, coût moyen, loss ratio, combined ratio, retention, provisions.\n- Graphiques : bar/line, heatmap garantie×segment, distribution des sinistres, courbes de survie.",
    examples: [
      "Quels segments portent le plus de sinistralité ?",
      "Analyse le loss ratio par garantie.",
      "Quelle est la distribution des coûts de sinistre ?",
    ],
  },
  {
    id: "telecom",
    label: "Télécom",
    description: "Trafic, débit, latence, couverture, churn et ARPU.",
    prompt:
      "Mode TÉLÉCOM.\n- KPI : trafic, débit, latence, disponibilité, churn, ARPU, couverture.\n- Graphiques : séries (line), heatmap cellules×temps, cartes de couverture (scattergeo), bar.",
    examples: [
      "Où sont les zones de mauvaise couverture ?",
      "Analyse la latence et le débit par cellule.",
      "Quels facteurs expliquent le churn ?",
    ],
  },
  {
    id: "public-sector",
    label: "Secteur public",
    description: "Budgets, populations, territoires, politiques publiques.",
    prompt:
      "Mode SECTEUR PUBLIC / TERRITOIRES.\n- KPI : population, budget, dépenses, équipements, indicateurs sociaux ; respecte la maille géographique et l'anonymat.\n- Graphiques : cartes (scattergeo/choropleth), bar, séries, heatmap.",
    examples: [
      "Compare les indicateurs par territoire.",
      "Analyse l'évolution budgétaire par secteur.",
      "Cartographie les équipements et leur accès.",
    ],
  },
];

const DOMAIN_BY_ID = new Map(ANALYSIS_DOMAINS.map((domain) => [domain.id, domain]));

export function getAnalysisDomain(id: string | null | undefined): AnalysisDomain {
  if (!id) return ANALYSIS_DOMAINS[0]!;
  return DOMAIN_BY_ID.get(id as AnalysisDomainId) ?? ANALYSIS_DOMAINS[0]!;
}

export function domainInstructions(id: string | null | undefined): string {
  return getAnalysisDomain(id).prompt;
}
