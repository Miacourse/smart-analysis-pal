export const PRO_PRICE_ID = "price_1UOqSXBoxBpL8B89ZmyeG152";
export const PRO_PRODUCT_ID = "prod_VPfoTNcE2F23lN";
export const TEAM_PRICE_ID = "price_1UPXaJBoxBpL8B89zDiFkz04";
export const TEAM_PRODUCT_ID = "prod_VQONeLgUE63zip";
export const FREE_ANALYSIS_LIMIT = 5;
export const FREE_MAX_FILE_MB = 5;
export const PRO_MAX_FILE_MB = 100;
export const TEAM_MAX_FILE_MB = 250;
export const FREE_MAX_ROWS = 50_000;
export const PRO_MAX_ROWS = 500_000;
export const TEAM_MAX_ROWS = 2_000_000;

export type Plan = "free" | "pro" | "team";
export type PaidPlan = Exclude<Plan, "free">;

export const PLAN_PRICES: Record<PaidPlan, { priceId: string; productId: string; eur: number }> = {
  pro: { priceId: PRO_PRICE_ID, productId: PRO_PRODUCT_ID, eur: 19 },
  team: { priceId: TEAM_PRICE_ID, productId: TEAM_PRODUCT_ID, eur: 49 },
};

export function planFromProduct(productId: string | null | undefined): Plan {
  if (productId === TEAM_PRODUCT_ID) return "team";
  if (productId === PRO_PRODUCT_ID) return "pro";
  return "free";
}

// Plan offert par un administrateur (indépendant de Stripe), s'il est encore valide.
export function activeCompPlan(
  compPlan: string | null | undefined,
  compExpiresAt: string | null | undefined,
  now: number = Date.now(),
): PaidPlan | null {
  if (compPlan !== "pro" && compPlan !== "team") return null;
  if (compExpiresAt && new Date(compExpiresAt).getTime() <= now) return null;
  return compPlan;
}

export function canAnalyze(isPro: boolean, used: number) {
  return isPro || used < FREE_ANALYSIS_LIMIT;
}

export function maxFileMb(plan: Plan) {
  return plan === "team" ? TEAM_MAX_FILE_MB : plan === "pro" ? PRO_MAX_FILE_MB : FREE_MAX_FILE_MB;
}

export function maxRows(plan: Plan) {
  return plan === "team" ? TEAM_MAX_ROWS : plan === "pro" ? PRO_MAX_ROWS : FREE_MAX_ROWS;
}

export function maxFileBytes(isPro: boolean, plan?: Plan) {
  return maxFileMb(plan ?? (isPro ? "pro" : "free")) * 1024 * 1024;
}

export function canExport(isPro: boolean) {
  return isPro;
}
