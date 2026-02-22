'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';
import { Transaction, Account, Category, Tag, UserSettings } from '@/core/models';

interface AppDataContextValue {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  userSettings: UserSettings | null;
  dataLoading: boolean;
  refresh: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshTags: () => Promise<void>;
  refreshUserSettings: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue>(null!);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const loadAll = useCallback(async (uid: string) => {
    setDataLoading(true);
    try {
      const [txns, accs, cats, tgs, settings] = await Promise.all([
        transactionRepository.getByUserId(uid, { limitCount: 100 }),
        accountRepository.getByUserId(uid),
        categoryRepository.getByUserId(uid),
        tagRepository.getByUserId(uid),
        userSettingsRepository.getOrCreate(uid),
      ]);

      setTransactions(txns);
      setAccounts(accs);
      setTags(tgs);
      setUserSettings(settings);

      if (cats.length === 0) {
        await categoryRepository.createDefaultCategories(uid);
        const updatedCats = await categoryRepository.getByUserId(uid);
        setCategories(updatedCats);
      } else {
        setCategories(cats);
      }
    } catch (error) {
      console.error('Failed to load app data:', error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.uid) {
      loadAll(user.uid);
    }
  }, [user?.uid, loadAll]);

  const refresh = useCallback(async () => {
    if (user?.uid) await loadAll(user.uid);
  }, [user?.uid, loadAll]);

  const refreshTransactions = useCallback(async () => {
    if (!user?.uid) return;
    const txns = await transactionRepository.getByUserId(user.uid, { limitCount: 100 });
    setTransactions(txns);
  }, [user?.uid]);

  const refreshAccounts = useCallback(async () => {
    if (!user?.uid) return;
    const accs = await accountRepository.getByUserId(user.uid);
    setAccounts(accs);
  }, [user?.uid]);

  const refreshCategories = useCallback(async () => {
    if (!user?.uid) return;
    const cats = await categoryRepository.getByUserId(user.uid);
    setCategories(cats);
  }, [user?.uid]);

  const refreshTags = useCallback(async () => {
    if (!user?.uid) return;
    const tgs = await tagRepository.getByUserId(user.uid);
    setTags(tgs);
  }, [user?.uid]);

  const refreshUserSettings = useCallback(async () => {
    if (!user?.uid) return;
    const settings = await userSettingsRepository.getOrCreate(user.uid);
    setUserSettings(settings);
  }, [user?.uid]);

  return (
    <AppDataContext.Provider
      value={{
        transactions,
        accounts,
        categories,
        tags,
        userSettings,
        dataLoading,
        refresh,
        refreshTransactions,
        refreshAccounts,
        refreshCategories,
        refreshTags,
        refreshUserSettings,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export const useAppData = () => useContext(AppDataContext);
