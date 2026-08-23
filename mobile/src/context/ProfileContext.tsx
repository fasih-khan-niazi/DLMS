import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import api from "../config/api";

export type UserProfile = {
  uid?: string;
  email?: string;
  displayName?: string;
  role?: string;
  activeBorrowCount?: number;
  totalOutstandingFines?: number;
  isActive?: boolean;
};

type ProfileContextValue = {
  profile: UserProfile | null;
  loading: boolean;
  isStaff: boolean;
  refresh: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  isStaff: false,
  refresh: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/api/auth/me");
      setProfile(res.data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isStaff = profile?.role === "librarian" || profile?.role === "admin";

  const value = useMemo(
    () => ({ profile, loading, isStaff, refresh }),
    [profile, loading, isStaff, refresh]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
