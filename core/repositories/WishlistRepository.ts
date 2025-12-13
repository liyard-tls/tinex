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
import { Wishlist, CreateWishlistInput, UpdateWishlistInput } from '@/core/models';

class WishlistRepository {
  private collectionName = FIREBASE_COLLECTIONS.WISHLISTS;

  async getAll(userId: string): Promise<Wishlist[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Wishlist));
  }

  async getById(id: string): Promise<Wishlist | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Wishlist;
  }

  async create(userId: string, input: CreateWishlistInput): Promise<string> {
    const now = Timestamp.now();
    const wishlistData = {
      userId,
      name: input.name,
      description: input.description || '',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, this.collectionName), wishlistData);
    return docRef.id;
  }

  async update(id: string, input: UpdateWishlistInput): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      ...input,
      updatedAt: Timestamp.now(),
    });
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
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

export const wishlistRepository = new WishlistRepository();
