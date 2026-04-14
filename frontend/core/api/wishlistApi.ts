import {
  Wishlist,
  WishlistItem,
  CreateWishlistInput,
  UpdateWishlistInput,
  CreateWishlistItemInput,
  UpdateWishlistItemInput,
} from '@/core/models';
import { apiFetch } from './client';

class WishlistApiRepository {
  async getAll(userId: string): Promise<Wishlist[]> {
    return apiFetch<Wishlist[]>('/api/v1/wishlists');
  }

  async getById(id: string): Promise<Wishlist | null> {
    try {
      return await apiFetch<Wishlist>(`/api/v1/wishlists/${id}`);
    } catch {
      return null;
    }
  }

  async create(userId: string, input: CreateWishlistInput): Promise<string> {
    const wl = await apiFetch<Wishlist>('/api/v1/wishlists', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return wl.id;
  }

  async update(id: string, input: UpdateWishlistInput): Promise<void> {
    await apiFetch(`/api/v1/wishlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/wishlists/${id}`, { method: 'DELETE' });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const list = await this.getAll(userId);
    await Promise.all(list.map((w) => this.delete(w.id)));
  }
}

class WishlistItemApiRepository {
  async getByWishlistId(wishlistId: string): Promise<WishlistItem[]> {
    return apiFetch<WishlistItem[]>(`/api/v1/wishlists/${wishlistId}/items`);
  }

  async getByUserId(userId: string): Promise<WishlistItem[]> {
    return apiFetch<WishlistItem[]>(`/api/v1/wishlists/items/user`);
  }

  async getById(id: string): Promise<WishlistItem | null> {
    // No dedicated endpoint; fetch from wishlist
    return null;
  }

  async create(
    userId: string,
    wishlistId: string,
    input: CreateWishlistItemInput
  ): Promise<string> {
    const item = await apiFetch<WishlistItem>(
      `/api/v1/wishlists/${wishlistId}/items`,
      { method: 'POST', body: JSON.stringify(input) }
    );
    return item.id;
  }

  async update(id: string, input: UpdateWishlistItemInput): Promise<void> {
    // wishlistId isn't available here; we include it as a placeholder
    await apiFetch(`/api/v1/wishlists/_/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async toggleConfirmed(id: string): Promise<void> {
    await apiFetch(`/api/v1/wishlists/_/items/${id}/toggle`, { method: 'PUT' });
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/wishlists/_/items/${id}`, { method: 'DELETE' });
  }

  async deleteAllForWishlist(wishlistId: string): Promise<void> {
    const items = await this.getByWishlistId(wishlistId);
    await Promise.all(items.map((i) => this.delete(i.id)));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    // Handled by wishlist cascade deletion
  }
}

export const wishlistRepository = new WishlistApiRepository();
export const wishlistItemRepository = new WishlistItemApiRepository();
