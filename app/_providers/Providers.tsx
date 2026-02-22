'use client';

import { AuthProvider } from './AuthProvider';
import { AppDataProvider } from './AppDataProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppDataProvider>{children}</AppDataProvider>
    </AuthProvider>
  );
}
