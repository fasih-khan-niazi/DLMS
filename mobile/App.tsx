import React from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider, useTheme } from "./src/theme";
import { ToastProvider } from "./src/components/AppToast";
import { getAppConfig, hydrateAppConfig } from "./src/utils/appConfig";
import { loadHapticsPreference } from "./src/utils/haptics";

// ye root App hai - theme aur navigation yahan wrap hote hain
function StatusBarSync() {
  const { mode, colors } = useTheme();

  React.useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.cream);
  }, [colors.cream]);

  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}

function Root() {
  React.useEffect(() => {
    void hydrateAppConfig().then(() => getAppConfig());
    void loadHapticsPreference();
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
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <View style={styles.root}>
          <Root />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
