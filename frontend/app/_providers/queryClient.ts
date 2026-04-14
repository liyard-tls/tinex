import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Fresh for 5 min — no refetch on mount/window-focus within this window
        staleTime: 5 * 60 * 1000,
        // Keep in memory (and in localStorage) for 24 hours
        gcTime: 24 * 60 * 60 * 1000,
        // Don't hammer Firestore on transient failures
        retry: 1,
        // Refetch silently in background when tab regains focus
        refetchOnWindowFocus: true,
      },
    },
  });
}
