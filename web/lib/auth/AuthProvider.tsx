"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getMe, updateMe } from "@/lib/api/users";
import type { Me } from "@/lib/types/api";

interface AuthContextValue {
  user: User | null;
  me: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    realName: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Track the uid we've fetched /users/mine for so we don't refetch on every
  // token refresh. onIdTokenChanged fires on sign-in, sign-out, AND periodic
  // refresh (every ~hour) — we only need to hit the API when the user changes.
  const loadedForUid = useRef<string | null>(null);

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, AND token refresh.
    // Using this (instead of onAuthStateChanged) ensures the API client
    // always sees the current token via user.getIdToken().
    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        loadedForUid.current = null;
        setMe(null);
        setLoading(false);
        return;
      }
      if (loadedForUid.current === fbUser.uid) {
        setLoading(false);
        return;
      }
      try {
        const profile = await getMe();
        loadedForUid.current = fbUser.uid;
        setMe(profile);
      } catch {
        // Non-fatal: the user is authed but we couldn't fetch the profile.
        // Gate-on-admin UIs will simply behave as non-admin. The profile will
        // be retried on next mount / token refresh.
        setMe(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      realName: string,
    ) => {
      const cred = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password,
      );
      // Mirror displayName onto the Firebase Auth profile for any downstream
      // consumer (e.g. avatar initials before /users/mine resolves).
      await updateProfile(cred.user, { displayName });
      // Seed displayName + realName into the Firestore user doc. The auto-create
      // in requireAuth will run first (triggered by getIdToken on the PATCH),
      // then this PATCH fills in the user-supplied values.
      const profile = await updateMe({ displayName, realName });
      loadedForUid.current = cred.user.uid;
      setMe(profile);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
    loadedForUid.current = null;
    setMe(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!getFirebaseAuth().currentUser) return;
    try {
      const profile = await getMe();
      setMe(profile);
    } catch {
      // swallow — caller can inspect `me` themselves
    }
  }, []);

  const value = useMemo(
    () => ({ user, me, loading, signIn, signUp, signOut, refreshMe }),
    [user, me, loading, signIn, signUp, signOut, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
