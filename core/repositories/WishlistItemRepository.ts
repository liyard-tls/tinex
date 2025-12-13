import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';
import { WishlistItem, CreateWishlistItemInput, UpdateWishlistItemInput } from '@/core/models';

class WishlistItemRepository {
  private collectionName = FIREBASE_COLLECTIONS.WISHLIST_ITEMS;

  async getByWishlistId(wishlistId: string): Promise<WishlistItem[]> {
    const q = query(
      collection(db, this.collectionName),
      where('wishlistId', '==', wishlistId),
      orderBy('amount', 'desc') // Sort by price, expensive first
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as WishlistItem));
  }

  async getByUserId(userId: string): Promise<WishlistItem[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as WishlistItem));
  }

  async getById(id: string): Promise<WishlistItem | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as WishlistItem;
  }

  async create(
    userId: string,
    wishlistId: string,
    input: CreateWishlistItemInput
  ): Promise<string> {
    const now = Timestamp.now();
    const itemData = {
      userId,
      wishlistId,
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      categoryId: input.categoryId,
      isConfirmed: input.isConfirmed || false,
      addedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, this.collectionName), itemData);
    return docRef.id;
  }

  async update(id: string, input: UpdateWishlistItemInput): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      ...input,
      updatedAt: Timestamp.now(),
    });
  }

  async toggleConfirmed(id: string): Promise<void> {
    const item = await this.getById(id);
    if (!item) return;

    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      isConfirmed: !item.isConfirmed,
      updatedAt: Timestamp.now(),
    });
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  async deleteAllForWishlist(wishlistId: string): Promise<void> {
    const q = query(collection(db, this.collectionName), where('wishlistId', '==', wishlistId));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });

    await batch.commit();
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const q = query(collection(db, this.collectionName), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });

    await batch.commit();
  }
}

export const wishlistItemRepository = new WishlistItemRepository();
