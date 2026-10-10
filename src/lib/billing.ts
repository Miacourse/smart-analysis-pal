export const PRO_PRICE_ID = "price_1UOqSXBoxBpL8B89ZmyeG152";
export const PRO_PRODUCT_ID = "prod_VPfoTNcE2F23lN";
export const FREE_ANALYSIS_LIMIT = 5;
export const FREE_MAX_FILE_MB = 5;
export const PRO_MAX_FILE_MB = 100;

export function canAnalyze(isPro: boolean, used: number) {
  return isPro || used < FREE_ANALYSIS_LIMIT;
}

export function maxFileBytes(isPro: boolean) {
  return (isPro ? PRO_MAX_FILE_MB : FREE_MAX_FILE_MB) * 1024 * 1024;
}

export function canExport(isPro: boolean) {
  return isPro;
}
