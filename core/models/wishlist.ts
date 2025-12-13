import { Timestamp } from 'firebase/firestore';
import { Currency } from './account';

export interface Wishlist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateWishlistInput {
  name: string;
  description?: string;
}

export interface UpdateWishlistInput {
  name?: string;
  description?: string;
}

export interface WishlistItem {
  id: string;
  wishlistId: string;
  userId: string;
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  isConfirmed: boolean;
  addedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateWishlistItemInput {
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  isConfirmed?: boolean;
}

export interface UpdateWishlistItemInput {
  name?: string;
  amount?: number;
  currency?: Currency;
  categoryId?: string;
  isConfirmed?: boolean;
}
