'use client';

import { PersistQueryClientProvider, PersistedClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { makeQueryClient } from './queryClient';
import { querySerializer } from './querySerializer';
import { AuthProvider } from './AuthProvider';
import { AppDataProvider } from './AppDataProvider';

// Singleton QueryClient — created once outside of render
const queryClient = makeQueryClient();

// Persister — only on client side (localStorage not available on server)
const persister =
  typeof window !== 'undefined'
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: 'tinex-query-cache',
        serialize: querySerializer.serialize,
        deserialize: querySerializer.deserialize as (str: string) => PersistedClient,
        throttleTime: 1000,
      })
    : undefined;

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: persister!,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      }}
    >
      <AuthProvider queryClient={queryClient}>
        <AppDataProvider>{children}</AppDataProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
