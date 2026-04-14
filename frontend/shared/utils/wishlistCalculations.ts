import { WishlistItem, Currency } from '@/core/models';
import { convertCurrency } from '@/shared/services/currencyService';

export async function calculateTotalAmount(
  items: WishlistItem[],
  targetCurrency: Currency
): Promise<number> {
  let total = 0;

  for (const item of items) {
    const convertedAmount = await convertCurrency(item.amount, item.currency, targetCurrency);
    total += convertedAmount;
  }

  return total;
}

export async function calculateConfirmedAmount(
  items: WishlistItem[],
  targetCurrency: Currency
): Promise<number> {
  let total = 0;
  const confirmedItems = items.filter((item) => item.isConfirmed);

  for (const item of confirmedItems) {
    const convertedAmount = await convertCurrency(item.amount, item.currency, targetCurrency);
    total += convertedAmount;
  }

  return total;
}

export function sortItemsByPrice(items: WishlistItem[]): WishlistItem[] {
  return [...items].sort((a, b) => b.amount - a.amount);
}
