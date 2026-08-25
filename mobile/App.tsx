import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider, useTheme } from "./src/theme";
import { ToastProvider } from "./src/components/AppToast";
import { getAppConfig, hydrateAppConfig } from "./src/utils/appConfig";

function StatusBarSync() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}

function Root() {
  React.useEffect(() => {
    void hydrateAppConfig().then(() => getAppConfig());
  }, []);

  return (
    <ToastProvider>
      <StatusBarSync />
      <AppNavigator />
    </ToastProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
