import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  ScheduledTransaction,
  CreateScheduledTransactionInput,
  UpdateScheduledTransactionInput,
  RecurrenceType,
} from '@/core/models';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';

/**
 * Advance nextDate by one recurrence interval.
 * Called after executing a recurring scheduled transaction.
 */
export function advanceNextDate(current: Date, recurrence: RecurrenceType): Date {
  const d = new Date(current);
  switch (recurrence) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'once':
      // No advance for one-time; caller sets isActive = false
      break;
  }
  return d;
}

export class ScheduledTransactionRepository {
  private col = FIREBASE_COLLECTIONS.SCHEDULED_TRANSACTIONS;

  private map(id: string, data: Record<string, unknown>): ScheduledTransaction {
    return {
      id,
      userId: data.userId as string,
      accountId: data.accountId as string,
      type: data.type as ScheduledTransaction['type'],
      amount: data.amount as number,
      currency: data.currency as ScheduledTransaction['currency'],
      description: data.description as string,
      categoryId: data.categoryId as string,
      tags: (data.tags as string[]) || [],
      fee: data.fee as number | undefined,
      nextDate: (data.nextDate as Timestamp).toDate(),
      recurrence: data.recurrence as RecurrenceType,
      endDate: data.endDate ? (data.endDate as Timestamp).toDate() : undefined,
      isActive: data.isActive as boolean,
      lastExecutedAt: data.lastExecutedAt
        ? (data.lastExecutedAt as Timestamp).toDate()
        : undefined,
      createdAt: (data.createdAt as Timestamp).toDate(),
      updatedAt: (data.updatedAt as Timestamp).toDate(),
    };
  }

  async create(
    userId: string,
    input: CreateScheduledTransactionInput,
    currency: string,
  ): Promise<string> {
    const now = Timestamp.fromDate(new Date());
    const payload: Record<string, unknown> = {
      userId,
      accountId: input.accountId,
      type: input.type,
      amount: input.amount,
      currency,
      description: input.description,
      categoryId: input.categoryId,
      tags: input.tags || [],
      nextDate: Timestamp.fromDate(input.nextDate),
      recurrence: input.recurrence,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    if (input.fee !== undefined) payload.fee = input.fee;
    if (input.endDate) payload.endDate = Timestamp.fromDate(input.endDate);

    const ref = await addDoc(collection(db, this.col), payload);
    return ref.id;
  }

  async getByUserId(userId: string): Promise<ScheduledTransaction[]> {
    const q = query(
      collection(db, this.col),
      where('userId', '==', userId),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => this.map(d.id, d.data() as Record<string, unknown>))
      .filter((s) => s.isActive)
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
  }

  async getUpcoming(userId: string, days: number): Promise<ScheduledTransaction[]> {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const all = await this.getByUserId(userId);
    return all.filter((s) => s.nextDate <= cutoff);
  }

  async update(input: UpdateScheduledTransactionInput): Promise<void> {
    const { id, ...rest } = input;
    const payload: Record<string, unknown> = {
      updatedAt: Timestamp.fromDate(new Date()),
    };
    if (rest.accountId !== undefined) payload.accountId = rest.accountId;
    if (rest.type !== undefined) payload.type = rest.type;
    if (rest.amount !== undefined) payload.amount = rest.amount;
    if (rest.description !== undefined) payload.description = rest.description;
    if (rest.categoryId !== undefined) payload.categoryId = rest.categoryId;
    if (rest.tags !== undefined) payload.tags = rest.tags;
    if (rest.fee !== undefined) payload.fee = rest.fee;
    if (rest.nextDate !== undefined) payload.nextDate = Timestamp.fromDate(rest.nextDate);
    if (rest.recurrence !== undefined) payload.recurrence = rest.recurrence;
    if (rest.endDate !== undefined) payload.endDate = Timestamp.fromDate(rest.endDate);
    if (rest.isActive !== undefined) payload.isActive = rest.isActive;
    if (rest.lastExecutedAt !== undefined)
      payload.lastExecutedAt = Timestamp.fromDate(rest.lastExecutedAt);

    await updateDoc(doc(db, this.col, id), payload);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, this.col, id));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const q = query(collection(db, this.col), where('userId', '==', userId));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
}

export const scheduledTransactionRepository = new ScheduledTransactionRepository();
