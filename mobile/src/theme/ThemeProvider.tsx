import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import * as SplashScreen from "expo-splash-screen";
import { lightTheme, type AppTheme } from "./lightTheme";
import { darkTheme } from "./darkTheme";
import { getStoredThemeMode, setStoredThemeMode, type ThemeMode } from "../utils/themePrefs";

SplashScreen.preventAutoHideAsync().catch(() => {});

type ThemeContextValue = AppTheme & {
  setMode: (mode: ThemeMode) => void;
  toggleDark: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  ...lightTheme,
  setMode: () => {},
  toggleDark: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [loaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await getStoredThemeMode();
      setModeState(stored);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded && ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, ready]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void setStoredThemeMode(next);
  }, []);

  const toggleDark = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      void setStoredThemeMode(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const base = mode === "dark" ? darkTheme : lightTheme;
    return { ...base, setMode, toggleDark };
  }, [mode, setMode, toggleDark]);

  if (!loaded || !ready) {
    return (
      <View style={[styles.boot, { backgroundColor: "#2E4A62" }]}>
        <ActivityIndicator size="large" color="#E8A838" />
      </View>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
