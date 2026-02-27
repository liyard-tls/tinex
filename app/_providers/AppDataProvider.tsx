'use client';

import { createContext, useCallback, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { QUERY_KEYS } from './queryKeys';
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
  const queryClient = useQueryClient();
  const uid = user?.uid ?? null;

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: QUERY_KEYS.transactions(uid ?? ''),
    queryFn: () => transactionRepository.getByUserId(uid!, { limitCount: 100 }),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });

  const { data: accounts = [], isLoading: accLoading } = useQuery({
    queryKey: QUERY_KEYS.accounts(uid ?? ''),
    queryFn: () => accountRepository.getByUserId(uid!),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: QUERY_KEYS.categories(uid ?? ''),
    queryFn: async () => {
      const cats = await categoryRepository.getByUserId(uid!);
      if (cats.length === 0) {
        await categoryRepository.createDefaultCategories(uid!);
        return categoryRepository.getByUserId(uid!);
      }
      return cats;
    },
    enabled: !!uid,
    staleTime: 10 * 60 * 1000,
  });

  const { data: tags = [], isLoading: tagLoading } = useQuery({
    queryKey: QUERY_KEYS.tags(uid ?? ''),
    queryFn: () => tagRepository.getByUserId(uid!),
    enabled: !!uid,
    staleTime: 10 * 60 * 1000,
  });

  const { data: userSettings = null, isLoading: settingsLoading } = useQuery({
    queryKey: QUERY_KEYS.userSettings(uid ?? ''),
    queryFn: () => userSettingsRepository.getOrCreate(uid!),
    enabled: !!uid,
    staleTime: 10 * 60 * 1000,
  });

  // True only on first load (no cached data yet); false instantly when cache is warm
  const dataLoading = !!uid && (txLoading || accLoading || catLoading || tagLoading || settingsLoading);

  const refreshTransactions = useCallback(async () => {
    if (!uid) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions(uid), refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.accounts(uid), refetchType: 'all' }),
    ]);
  }, [queryClient, uid]);

  const refreshAccounts = useCallback(async () => {
    if (!uid) return;
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.accounts(uid), refetchType: 'all' });
  }, [queryClient, uid]);

  const refreshCategories = useCallback(async () => {
    if (!uid) return;
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories(uid) });
  }, [queryClient, uid]);

  const refreshTags = useCallback(async () => {
    if (!uid) return;
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tags(uid) });
  }, [queryClient, uid]);

  const refreshUserSettings = useCallback(async () => {
    if (!uid) return;
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userSettings(uid) });
  }, [queryClient, uid]);

  const refresh = useCallback(async () => {
    if (!uid) return;
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all(uid) });
  }, [queryClient, uid]);

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
