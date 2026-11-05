import type { AnalysisDomainId } from "./analysis-domains";
import { ANALYSIS_DOMAINS } from "./analysis-domains";
import type { Lang } from "./i18n";

const LABEL_EN: Record<AnalysisDomainId, string> = {
  general: "General",
  geophysics: "Geophysics",
  geochemistry: "Geochemistry",
  geology: "Geology",
  environment: "Environment",
  marketing: "Marketing",
  finance: "Finance",
  healthcare: "Healthcare",
  logistics: "Logistics",
  energy: "Energy",
  agriculture: "Agriculture",
  industry: "Industry",
  hr: "Human resources",
  education: "Education",
  research: "Research",
  sports: "Sports",
  "real-estate": "Real estate",
  insurance: "Insurance",
  telecom: "Telecom",
  "public-sector": "Public sector",
};

const DESCRIPTION_EN: Record<AnalysisDomainId, string> = {
  general: "Any tabular data: sales, operations, surveys, business files.",
  geophysics: "Electrical tomography, seismic, gravimetry, magnetism, GPR.",
  geochemistry: "Rocks, soils, waters, mining exploration, major and trace elements.",
  geology: "Lithology, stratigraphy, structures, maps and sections.",
  environment: "Water, air, soil, biodiversity, climate and regulatory compliance.",
  marketing: "Sales, conversion, CAC/LTV, cohorts, campaigns and attribution.",
  finance: "P&L, cash flow, budget vs actual, variances, markets.",
  healthcare: "Epidemiology, care pathways, quality, health costs.",
  logistics: "Supply chain, inventory, OTIF, routes and transport.",
  energy: "Production, consumption, grid, efficiency and decarbonization.",
  agriculture: "Yields, plots, inputs, weather and agroecology.",
  industry: "OEE/TRS, quality, SPC, maintenance and defects.",
  hr: "Headcount, turnover, absenteeism, payroll, engagement.",
  education: "Results, progress, attendance, cohorts and skills.",
  research: "Statistics, protocols, distributions, tests and correlations.",
  sports: "Performance, training load, injuries, matches.",
  "real-estate": "Prices, yields, vacancy, energy ratings and geography.",
  insurance: "Claims, premiums, loss ratio, reserves and risks.",
  telecom: "Traffic, throughput, latency, coverage, churn and ARPU.",
  "public-sector": "Budgets, populations, territories, public policies.",
};

const EXAMPLES_EN: Record<AnalysisDomainId, string[]> = {
  general: [
    "What are the main indicators and trends?",
    "Which segments or anomalies stand out?",
    "What concrete actions do you recommend?",
  ],
  geophysics: [
    "Analyze this ERT pseudo-section: where are the conductive zones?",
    "Compare the amplitudes along the seismic profile.",
    "Map the magnetic anomalies by station.",
  ],
  geochemistry: [
    "Classify these samples in a QAP diagram.",
    "What correlations between major and trace elements?",
    "Plot the normalized rare earth spectra.",
  ],
  geology: [
    "Describe the stratigraphic succession of this borehole.",
    "Draw a geological cross-section from the surveys.",
    "Analyze the fracture directions (rose diagram).",
  ],
  environment: [
    "Which parameters exceed the regulatory limits?",
    "Show the seasonal trend of water quality.",
    "Map the stations and their pollution level.",
  ],
  marketing: [
    "Where is conversion lost in my funnel?",
    "Which channels have the best ROAS?",
    "Compare LTV by acquisition cohort.",
  ],
  finance: [
    "Explain the budget vs actual gap by line item.",
    "What is the cash flow trend?",
    "Trace a waterfall of margin changes.",
  ],
  healthcare: [
    "What is the weekly incidence trend?",
    "Compare survival between treatment groups.",
    "Analyze time-to-care.",
  ],
  logistics: [
    "Which warehouses have the most stockouts?",
    "Analyze delivery delays by carrier.",
    "Map the routes and delivery points.",
  ],
  energy: [
    "Trace the typical hourly load curve.",
    "What is the production mix and its evolution?",
    "Where are the efficiency losses?",
  ],
  agriculture: [
    "Which factors explain yield differences?",
    "Compare yield and rainfall per plot.",
    "Map the plots and their yields.",
  ],
  industry: [
    "Which machines limit OEE?",
    "Draw a control chart and detect drift.",
    "Which defects concentrate the most impact (Pareto)?",
  ],
  hr: [
    "Which departments have the highest turnover?",
    "Analyze absenteeism by month and by team.",
    "What is the payroll trend?",
  ],
  education: [
    "Which subjects are the most difficult?",
    "Compare cohort progress.",
    "Analyze the link between attendance and success.",
  ],
  research: [
    "Which variables are correlated and to what extent?",
    "Compare distributions between groups.",
    "Is there a significant effect after controlling for covariates?",
  ],
  sports: [
    "Analyze training load and injury risk.",
    "Compare the physical profiles of players.",
    "Which metrics distinguish won matches?",
  ],
  "real-estate": [
    "Which neighborhoods offer the best yield?",
    "Analyze price per square meter trends.",
    "Map the properties and their performance.",
  ],
  insurance: [
    "Which segments carry the most claims?",
    "Analyze the loss ratio by guarantee.",
    "What is the distribution of claim costs?",
  ],
  telecom: [
    "Where are the poor coverage zones?",
    "Analyze latency and throughput per cell.",
    "Which factors explain churn?",
  ],
  "public-sector": [
    "Compare indicators by territory.",
    "Analyze budget evolution by sector.",
    "Map facilities and their access.",
  ],
};

const byId = new Map(ANALYSIS_DOMAINS.map((domain) => [domain.id, domain]));

export function domainLabel(id: AnalysisDomainId, lang: Lang): string {
  if (lang === "en") return LABEL_EN[id];
  return byId.get(id)?.label ?? id;
}

export function domainDescription(id: AnalysisDomainId, lang: Lang): string {
  if (lang === "en") return DESCRIPTION_EN[id];
  return byId.get(id)?.description ?? "";
}

export function domainExamples(id: AnalysisDomainId, lang: Lang): string[] {
  if (lang === "en") return EXAMPLES_EN[id];
  return byId.get(id)?.examples ?? [];
}
