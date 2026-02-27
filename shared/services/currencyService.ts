import { Currency } from "@/core/models";

// Exchange rates cache — expires at the same time as the provider's next update
let exchangeRatesCache: {
  rates: Record<string, number>;
  expiresAt: number;
} | null = null;

/**
 * Fetches exchange rates from our Next.js API route
 * The API route handles the CurrencyFreaks API call server-side
 * This keeps the API key secure and not exposed to the client
 */
async function fetchExchangeRates(): Promise<Record<string, number>> {
  // Check cache — expires when the provider publishes new rates
  if (exchangeRatesCache && Date.now() < exchangeRatesCache.expiresAt) {
    return exchangeRatesCache.rates;
  }

  try {
    // Call our Next.js API route instead of external API directly
    const response = await fetch("/api/currency");

    if (!response.ok) {
      throw new Error("Failed to fetch exchange rates from API");
    }

    const data = await response.json();

    if (!data.success || !data.rates) {
      throw new Error("Invalid response from currency API");
    }

    // Cache until the provider's next update (passed from the API route)
    exchangeRatesCache = {
      rates: data.rates,
      expiresAt: data.expiresAt ?? Date.now() + 3600000,
    };

    return data.rates;
  } catch (error) {
    console.error("Failed to fetch exchange rates:", error);

    // Return fallback rates if API fails
    return getFallbackRates();
  }
}

/**
 * Fallback exchange rates (approximate values)
 * Used when API is unavailable
 */
function getFallbackRates(): Record<string, number> {
  return {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.5,
    CAD: 1.36,
    AUD: 1.53,
    CHF: 0.88,
    CNY: 7.24,
    UAH: 41.92,
    SGD: 1.34,
  };
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency = "USD"
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  try {
    const rates = await fetchExchangeRates();

    // Check if rates exist for both currencies
    if (!rates[fromCurrency] || !rates[toCurrency]) {
      console.warn(
        `Missing exchange rate for ${fromCurrency} or ${toCurrency}`
      );
      return amount; // Return original amount if rate is missing
    }

    // CurrencyFreaks API: 1 USD = rates[currency]
    // To convert FROM a currency TO USD: amount / rates[fromCurrency]
    // To convert FROM USD TO a currency: amount * rates[toCurrency]

    if (fromCurrency === "USD") {
      // From USD to another currency
      return amount * rates[toCurrency];
    } else if (toCurrency === "USD") {
      // From another currency to USD
      return amount / rates[fromCurrency];
    } else {
      // From one currency to another (via USD)
      const amountInUSD = amount / rates[fromCurrency];
      return amountInUSD * rates[toCurrency];
    }
  } catch (error) {
    console.error("Currency conversion failed:", error);
    // Return original amount if conversion fails
    return amount;
  }
}

/**
 * Convert multiple amounts from different currencies to a target currency
 */
export async function convertMultipleCurrencies(
  amounts: Array<{ amount: number; currency: Currency }>,
  toCurrency: Currency = "USD"
): Promise<number> {
  const rates = await fetchExchangeRates();

  const total = amounts.reduce((sum, item) => {
    if (item.currency === toCurrency) {
      return sum + item.amount;
    }

    // Check if rate exists for the currency
    if (!rates[item.currency] || !rates[toCurrency]) {
      console.warn(
        `Missing exchange rate for ${item.currency} or ${toCurrency}`
      );
      return sum + item.amount; // Add original amount if rate is missing
    }

    // CurrencyFreaks API: 1 USD = rates[currency]
    if (item.currency === "USD") {
      // From USD to target currency
      return sum + item.amount * rates[toCurrency];
    } else if (toCurrency === "USD") {
      // From item currency to USD
      return sum + item.amount / rates[item.currency];
    } else {
      // From one currency to another (via USD)
      const amountInUSD = item.amount / rates[item.currency];
      const convertedAmount = amountInUSD * rates[toCurrency];
      return sum + convertedAmount;
    }
  }, 0);

  return total;
}

/**
 * Get the current exchange rate from one currency to another
 */
export async function getExchangeRate(
  fromCurrency: Currency,
  toCurrency: Currency = "USD"
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  try {
    const rates = await fetchExchangeRates();

    // CurrencyFreaks API: 1 USD = rates[currency]
    if (fromCurrency === "USD") {
      // USD to another currency
      return rates[toCurrency];
    } else if (toCurrency === "USD") {
      // Another currency to USD
      return 1 / rates[fromCurrency];
    } else {
      // One currency to another (via USD)
      const rateToUSD = 1 / rates[fromCurrency];
      return rateToUSD * rates[toCurrency];
    }
  } catch (error) {
    console.error("Failed to get exchange rate:", error);
    return 1;
  }
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const currencySymbols: Record<Currency, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    CNY: "¥",
    UAH: "₴",
    SGD: "S$",
  };

  const symbol = currencySymbols[currency] || currency;

  // Format with 2 decimal places, except for JPY which doesn't use decimals
  const formattedAmount =
    currency === "JPY"
      ? Math.round(amount).toLocaleString()
      : amount.toFixed(2);

  return `${symbol} ${formattedAmount}`;
}

/**
 * Clear the exchange rates cache
 */
export function clearCurrencyCache(): void {
  exchangeRatesCache = null;
}
