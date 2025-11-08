import { Currency } from '@/core/models';

// Exchange rates cache
let exchangeRatesCache: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Fetches exchange rates from ExchangeRate-API (free tier)
 * Free tier: 1,500 requests/month
 * Alternative: https://api.frankfurter.app/latest?from=USD (unlimited, EU-based)
 */
async function fetchExchangeRates(): Promise<Record<string, number>> {
  // Check cache first
  if (exchangeRatesCache && Date.now() - exchangeRatesCache.timestamp < CACHE_DURATION) {
    return exchangeRatesCache.rates;
  }

  try {
    // Using Frankfurter API (free, no API key required, unlimited requests)
    const response = await fetch('https://api.frankfurter.app/latest?from=USD');

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();

    // Frankfurter returns rates with USD as base (1 USD = X currency)
    const rates: Record<string, number> = {
      USD: 1,
      ...data.rates,
    };

    // Cache the rates
    exchangeRatesCache = {
      rates,
      timestamp: Date.now(),
    };

    return rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);

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
    JPY: 149.50,
    CAD: 1.36,
    AUD: 1.53,
    CHF: 0.88,
    CNY: 7.24,
    UAH: 36.50,
  };
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency = 'USD'
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  try {
    const rates = await fetchExchangeRates();

    // Convert to USD first, then to target currency
    const amountInUSD = amount / rates[fromCurrency];
    const convertedAmount = amountInUSD * rates[toCurrency];

    return convertedAmount;
  } catch (error) {
    console.error('Currency conversion failed:', error);
    // Return original amount if conversion fails
    return amount;
  }
}

/**
 * Convert multiple amounts from different currencies to a target currency
 */
export async function convertMultipleCurrencies(
  amounts: Array<{ amount: number; currency: Currency }>,
  toCurrency: Currency = 'USD'
): Promise<number> {
  const rates = await fetchExchangeRates();

  const total = amounts.reduce((sum, item) => {
    if (item.currency === toCurrency) {
      return sum + item.amount;
    }

    // Convert to USD first, then to target currency
    const amountInUSD = item.amount / rates[item.currency];
    const convertedAmount = amountInUSD * rates[toCurrency];

    return sum + convertedAmount;
  }, 0);

  return total;
}

/**
 * Get the current exchange rate from one currency to another
 */
export async function getExchangeRate(
  fromCurrency: Currency,
  toCurrency: Currency = 'USD'
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  try {
    const rates = await fetchExchangeRates();

    // Convert to USD first, then to target currency
    const rateToUSD = 1 / rates[fromCurrency];
    const rateToTarget = rateToUSD * rates[toCurrency];

    return rateToTarget;
  } catch (error) {
    console.error('Failed to get exchange rate:', error);
    return 1;
  }
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const currencySymbols: Record<Currency, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF',
    CNY: '¥',
    UAH: '₴',
  };

  const symbol = currencySymbols[currency] || currency;

  // Format with 2 decimal places, except for JPY which doesn't use decimals
  const formattedAmount = currency === 'JPY'
    ? Math.round(amount).toLocaleString()
    : amount.toFixed(2);

  return `${symbol}${formattedAmount}`;
}

/**
 * Clear the exchange rates cache
 */
export function clearCurrencyCache(): void {
  exchangeRatesCache = null;
}
