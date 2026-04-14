'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { QueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { apiFetch } from '@/core/api/client';

interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  authLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null!);

interface AuthProviderProps {
  children: React.ReactNode;
  queryClient: QueryClient;
}

export function AuthProvider({ children, queryClient }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Upsert user row in PostgreSQL before any other API calls fire.
        // All other tables (settings, categories, accounts…) have a FK on users(id).
        try {
          await apiFetch('/api/v1/users', {
            method: 'POST',
            body: JSON.stringify({
              email: firebaseUser.email ?? '',
              displayName: firebaseUser.displayName ?? '',
              photoUrl: firebaseUser.photoURL ?? '',
            }),
          });
        } catch (e) {
          console.error('[AuthProvider] user upsert failed', e);
        }
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
        });
      } else {
        setUser(null);
        router.push('/auth');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    // Clear all cached query data to prevent data leakage between users
    queryClient.clear();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('tinex-query-cache');
    }
    router.push('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
