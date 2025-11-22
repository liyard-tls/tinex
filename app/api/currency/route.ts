import { NextResponse } from 'next/server';

// Cache for exchange rates
let exchangeRatesCache: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

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
  // Check cache first
  if (exchangeRatesCache && Date.now() - exchangeRatesCache.timestamp < CACHE_DURATION) {
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

    // Cache the rates
    exchangeRatesCache = {
      rates,
      timestamp: Date.now(),
    };

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

    return NextResponse.json({
      success: true,
      rates,
      timestamp: Date.now(),
      cached: exchangeRatesCache !== null,
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
