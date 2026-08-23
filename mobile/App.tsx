import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider } from "./src/theme";
import { getAppConfig, hydrateAppConfig } from "./src/utils/appConfig";

export default function App() {
  useEffect(() => {
    void hydrateAppConfig().then(() => getAppConfig());
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
