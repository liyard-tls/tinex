'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
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
    router.push('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
