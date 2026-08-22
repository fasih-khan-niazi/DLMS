import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Literata_400Regular,
  Literata_700Bold,
} from "@expo-google-fonts/literata";
import * as SplashScreen from "expo-splash-screen";
import { lightTheme, type AppTheme } from "./lightTheme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const ThemeContext = createContext<AppTheme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Literata_400Regular,
    Literata_700Bold,
  });

  React.useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  const value = useMemo(() => lightTheme, []);

  if (!loaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={lightTheme.colors.navy} />
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
    backgroundColor: lightTheme.colors.cream,
  },
});
