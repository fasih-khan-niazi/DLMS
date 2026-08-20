import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { api } from "../config/api";
import { firebaseAuth } from "../config/firebase";

export type AdminProfile = {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
};

type AuthContextValue = {
  user: User | null;
  profile: AdminProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadAdminProfile(): Promise<AdminProfile> {
  try {
    const { data } = await api.get<AdminProfile>("/api/auth/me");
    if (data.role !== "admin") {
      throw new Error("Admin access required. Librarians should use the mobile app.");
    }
    return data;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("Admin access required")) {
      throw err;
    }
    throw new Error("Could not verify admin profile. Is the API running on port 5000?");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (next) => {
      setLoading(true);
      setError(null);
      try {
        if (!next) {
          setUser(null);
          setProfile(null);
          return;
        }
        setUser(next);
        const adminProfile = await loadAdminProfile();
        setProfile(adminProfile);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to verify admin access";
        setError(message);
        setProfile(null);
        setUser(null);
        await signOut(firebaseAuth);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      // profile load handled by onAuthStateChanged
    } catch (err: unknown) {
      setLoading(false);
      const message =
        err && typeof err === "object" && "code" in err
          ? "Invalid email or password"
          : "Login failed";
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await signOut(firebaseAuth);
    setUser(null);
    setProfile(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      login,
      logout,
      clearError,
    }),
    [user, profile, loading, error, login, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
