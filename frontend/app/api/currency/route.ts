import { NextResponse } from 'next/server';

// Cache for exchange rates
let exchangeRatesCache: { rates: Record<string, number>; expiresAt: number } | null = null;

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
    UAH: 41.92,
  };
}

/**
 * Fetches exchange rates from ExchangeRate API
 * API key is stored server-side only
 */
async function fetchExchangeRates(): Promise<Record<string, number>> {
  // Check cache — expires at the time the provider publishes new rates
  if (exchangeRatesCache && Date.now() < exchangeRatesCache.expiresAt) {
    return exchangeRatesCache.rates;
  }

  try {
    // Get API key from server-side environment variable
    const apiKey = process.env.CURRENCY_API_KEY;

    if (!apiKey) {
      console.warn('CURRENCY_API_KEY not set, using fallback rates');
      return getFallbackRates();
    }

    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();

    // Check if the API call was successful
    if (data.result !== 'success') {
      throw new Error('API returned error result');
    }

    // ExchangeRate API returns conversion_rates object with USD as base
    const rates: Record<string, number> = data.conversion_rates;

    // Use the provider's own next-update timestamp, but only if it's in the future.
    // Free-tier keys may return stale data with a past next-update time — fall back to 1 hour.
    const providerExpiry = data.time_next_update_unix ? data.time_next_update_unix * 1000 : 0;
    const expiresAt = providerExpiry > Date.now() ? providerExpiry : Date.now() + 3600000;

    exchangeRatesCache = { rates, expiresAt };

    return rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    return getFallbackRates();
  }
}

/**
 * GET /api/currency
 * Returns current exchange rates
 */
export async function GET() {
  try {
    const rates = await fetchExchangeRates();
    const expiresAt = exchangeRatesCache?.expiresAt ?? Date.now() + 3600000;

    return NextResponse.json({
      success: true,
      rates,
      expiresAt,
    });
  } catch (error) {
    console.error('Currency API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch exchange rates',
        rates: getFallbackRates(),
      },
      { status: 500 }
    );
  }
}
