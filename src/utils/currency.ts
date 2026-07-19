export type CurrencyCode = "EUR" | "UAH" | "USD";

export interface RateDetail {
  buy: number;
  sell: number;
}

export interface ExchangeRates {
  EUR: number; // 1 EUR = X UAH
  USD: number; // 1 USD = Y UAH
  eurDetail?: RateDetail;
  usdDetail?: RateDetail;
}

export const DEFAULT_RATES: ExchangeRates = {
  EUR: 45.8, // default to sell rate
  USD: 42.1, // default to sell rate
  eurDetail: { buy: 45.0, sell: 45.8 },
  usdDetail: { buy: 41.5, sell: 42.1 },
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: "€",
  UAH: "₴",
  USD: "$",
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  EUR: "EUR (€)",
  UAH: "UAH (₴)",
  USD: "USD ($)",
};

/**
 * Converts a price from EUR (base) to the target currency.
 */
export function convertEurTo(
  amountInEur: number,
  targetCurrency: CurrencyCode,
  rates: ExchangeRates
): number {
  if (targetCurrency === "EUR") {
    return amountInEur;
  }
  const eurRate = rates.eurDetail?.sell ?? rates.EUR;
  const usdRate = rates.usdDetail?.sell ?? rates.USD;

  if (targetCurrency === "UAH") {
    return amountInEur * eurRate;
  }
  if (targetCurrency === "USD") {
    if (usdRate > 0) {
      return amountInEur * (eurRate / usdRate);
    }
    return amountInEur * 1.09; // standard fallback multiplier
  }
  return amountInEur;
}

/**
 * Converts a price from the source currency back to EUR.
 */
export function convertToEur(
  amount: number,
  sourceCurrency: CurrencyCode,
  rates: ExchangeRates
): number {
  if (sourceCurrency === "EUR") {
    return amount;
  }
  const eurRate = rates.eurDetail?.sell ?? rates.EUR;
  const usdRate = rates.usdDetail?.sell ?? rates.USD;

  if (sourceCurrency === "UAH") {
    return eurRate > 0 ? amount / eurRate : amount / 45.8;
  }
  if (sourceCurrency === "USD") {
    if (eurRate > 0 && usdRate > 0) {
      return amount / (eurRate / usdRate);
    }
    return amount / 1.09;
  }
  return amount;
}

/**
 * Formats a value in the target currency with its symbol.
 */
export function formatCurrencyValue(
  amountInEur: number,
  targetCurrency: CurrencyCode,
  rates: ExchangeRates
): string {
  const converted = convertEurTo(amountInEur, targetCurrency, rates);
  const symbol = CURRENCY_SYMBOLS[targetCurrency];
  
  if (targetCurrency === "EUR" || targetCurrency === "USD") {
    return `${symbol}${converted.toFixed(2)}`;
  }
  // For UAH, typically place symbol after the number
  return `${converted.toFixed(2)} ${symbol}`;
}
