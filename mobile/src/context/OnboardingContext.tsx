import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isOnboardingDone } from "../utils/onboarding";
import { OnboardingCarousel } from "../components/OnboardingCarousel";
import { useProfile } from "./ProfileContext";

type OnboardingContextValue = {
  openOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue>({
  openOnboarding: () => {},
});

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const uid = profile?.uid;
    if (!uid) return;

    void isOnboardingDone(uid).then((done) => {
      if (cancelled) return;
      if (!done) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  const openOnboarding = useCallback(() => setVisible(true), []);
  const value = useMemo(() => ({ openOnboarding }), [openOnboarding]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <OnboardingCarousel visible={visible} onClose={() => setVisible(false)} />
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
