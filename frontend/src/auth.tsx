import { useEffect, useState, useCallback, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  type User,
} from 'firebase/auth';

// --- Firebase config ---
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missingVars = requiredEnvVars.filter((v) => !import.meta.env[v]);
if (missingVars.length > 0) {
  console.error('Missing Firebase environment variables:', missingVars);
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let firebaseApp: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;

try {
  if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId) {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    auth.languageCode = 'en';
  } else {
    console.warn('Firebase configuration is incomplete. Running in guest/demo mode.');
  }
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

// --- Types ---
export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// --- Provider ---
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!auth) {
      setLoading(false);
      return;
    }

    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user && isMounted) {
          setUser(result.user);
        }
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
          console.error('Redirect check error:', err);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!isMounted) return;
      setUser(firebaseUser);
      setLoading(false);
    });

    checkRedirect();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // --- Google Sign In ---
  const _googleSignIn = useCallback(async (extraParams: Record<string, string> = {}) => {
    if (!auth) throw new Error('Firebase Auth is not initialized.');
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account', ...extraParams });

    try {
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; stack?: string };
      if (auth.currentUser) return;
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, provider);
        return;
      }
      const isCOOP =
        e.message?.includes('Cross-Origin-Opener-Policy') ||
        e.message?.includes('window.closed') ||
        e.stack?.includes('popup.ts');
      if (isCOOP && auth.currentUser) return;
      throw e;
    }
  }, []);

  const signInWithGoogle = useCallback(() => _googleSignIn(), [_googleSignIn]);
  const signUpWithGoogle = useCallback(() => _googleSignIn({ prompt: 'select_account consent' }), [_googleSignIn]);

  // --- Email Sign In ---
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  // --- Email Sign Up ---
  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Set display name
    await updateProfile(result.user, { displayName });
    // Send verification email
    await sendEmailVerification(result.user);
  }, []);

  // --- Password Reset ---
  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  // --- Resend Verification Email ---
  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) throw new Error('No user is signed in.');
    await sendEmailVerification(auth.currentUser);
  }, []);

  // --- Sign Out ---
  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  // --- Get ID Token ---
  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    signInWithGoogle,
    signUpWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    signOutUser,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const getAuthTokenGetter = (authContext?: AuthContextValue) => {
  return async () => {
    if (!authContext) return null;
    return authContext.getIdToken();
  };
};
