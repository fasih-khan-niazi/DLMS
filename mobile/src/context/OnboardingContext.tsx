import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isOnboardingDone } from "../utils/onboarding";
import { OnboardingCarousel } from "../components/OnboardingCarousel";

type OnboardingContextValue = {
  openOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue>({
  openOnboarding: () => {},
});

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isOnboardingDone().then((done) => {
      if (cancelled) return;
      setChecked(true);
      if (!done) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openOnboarding = useCallback(() => setVisible(true), []);
  const value = useMemo(() => ({ openOnboarding }), [openOnboarding]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {checked ? (
        <OnboardingCarousel visible={visible} onClose={() => setVisible(false)} />
      ) : null}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
