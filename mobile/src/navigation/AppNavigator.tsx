import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import { registerForPushNotifications } from "../utils/notifications";
import api from "../config/api";
import { ProfileProvider, useProfile } from "../context/ProfileContext";
import { OnboardingProvider } from "../context/OnboardingContext";
import { useToast } from "../components/AppToast";
import { useTheme } from "../theme";
import {
  getAppConfig,
  invalidateAppConfigCache,
  peekLibrariansCanBorrow,
} from "../utils/appConfig";
import * as Haptics from "../utils/haptics";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import HomeScreen from "../screens/HomeScreen";
import CatalogHubScreen from "../screens/CatalogHubScreen";
import BookDetailScreen from "../screens/BookDetailScreen";
import AddBookScreen from "../screens/AddBookScreen";
import ScanScreen from "../screens/ScanScreen";
import ActivityScreen from "../screens/ActivityScreen";
import ProfileScreen from "../screens/ProfileScreen";
import DigitalBookDetailScreen from "../screens/DigitalBookDetailScreen";
import BookshelfScreen from "../screens/BookshelfScreen";
import UploadDigitalBookScreen from "../screens/UploadDigitalBookScreen";
import PdfReaderScreen from "../screens/PdfReaderScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import UnifiedSearchScreen from "../screens/UnifiedSearchScreen";

const AuthStackNav = createNativeStackNavigator();
const HomeStackNav = createNativeStackNavigator();
const CatalogStackNav = createNativeStackNavigator();
const ProfileStackNav = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/** How often the librarian Scan gate is refreshed in the background. */
const SCAN_GATE_REFRESH_MS = 30_000;

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function TabBarIcon({
  focused,
  color,
  size,
  outline,
  solid,
}: {
  focused: boolean;
  color: string;
  size: number;
  outline: IoniconName;
  solid: IoniconName;
}) {
  const { colors, mode } = useTheme();
  const iconName = focused ? solid : outline;
  const glowColor = mode === "dark" ? colors.amber : colors.navy;

  return (
    <View
      style={{
        width: 28,
        height: 28,
        alignItems: "center",
        justifyContent: "center",
        ...(focused
          ? {
              shadowColor: glowColor,
              shadowOpacity: 0.75,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
              elevation: 8,
            }
          : null),
      }}
    >
      <Ionicons name={iconName} size={size} color={color} />
    </View>
  );
}

function CustomTabBarButton(props: any) {
  const { onPress, onLongPress, style, children, ...rest } = props;
  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      style={({ pressed }) => [
        style,
        {
          opacity: pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <HomeStackNav.Screen name="HomeMain" component={HomeScreen} />
      <HomeStackNav.Screen name="Notifications" component={NotificationsScreen} />
      <HomeStackNav.Screen
        name="UnifiedSearch"
        component={UnifiedSearchScreen as React.ComponentType<any>}
      />
    </HomeStackNav.Navigator>
  );
}

function CatalogStackNavigator() {
  return (
    <CatalogStackNav.Navigator screenOptions={{ headerShown: false }}>
      <CatalogStackNav.Screen
        name="CatalogMain"
        component={CatalogHubScreen as React.ComponentType<any>}
      />
      <CatalogStackNav.Screen
        name="BookDetail"
        component={BookDetailScreen as React.ComponentType<any>}
      />
      <CatalogStackNav.Screen
        name="DigitalBookDetail"
        component={DigitalBookDetailScreen as React.ComponentType<any>}
      />
      <CatalogStackNav.Screen
        name="PdfReader"
        component={PdfReaderScreen as React.ComponentType<any>}
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <CatalogStackNav.Screen
        name="UploadDigitalBook"
        component={UploadDigitalBookScreen as React.ComponentType<any>}
      />
    </CatalogStackNav.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStackNav.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStackNav.Screen name="Bookshelf" component={BookshelfScreen} />
      <ProfileStackNav.Screen name="AddBook" component={AddBookScreen} />
      <ProfileStackNav.Screen name="UploadDigitalBook" component={UploadDigitalBookScreen} />
    </ProfileStackNav.Navigator>
  );
}

function MainTabs() {
  return (
    <ProfileProvider>
      <OnboardingProvider>
        <MainTabNavigator />
      </OnboardingProvider>
    </ProfileProvider>
  );
}

function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const { colors, mode } = useTheme();
  const { profile, refresh } = useProfile();
  const { showToast } = useToast();

  /**
   * Synchronous snapshot of whether Scan is closed to this librarian.
   * Kept warm in the background so a tab press never waits on the network:
   * feedback (haptic + toast) and the block decision happen in the same tick.
   */
  const scanBlockedRef = useRef(false);

  const computeScanBlocked = useCallback(
    (librariansCanBorrow: boolean | null, activeLoans: number) => {
      if (profile?.role !== "librarian") return false;
      if (librariansCanBorrow !== false) return false;
      // Borrowing off but loans outstanding: Scan stays open for returns only.
      return activeLoans === 0;
    },
    [profile?.role]
  );

  // Seed instantly from whatever config is already in memory, then revalidate.
  useEffect(() => {
    if (profile?.role !== "librarian") {
      scanBlockedRef.current = false;
      return;
    }

    const activeLoans = Number(profile?.activeBorrowCount) || 0;
    scanBlockedRef.current = computeScanBlocked(peekLibrariansCanBorrow(), activeLoans);

    let cancelled = false;
    const sync = async () => {
      const config = await getAppConfig(true);
      if (cancelled) return;
      scanBlockedRef.current = computeScanBlocked(config.librariansCanBorrow, activeLoans);
    };

    void sync();
    const interval = setInterval(() => void sync(), SCAN_GATE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profile?.role, profile?.activeBorrowCount, computeScanBlocked]);

  /** Re-checks the gate against the server; resolves true when Scan may open. */
  const revalidateScanGate = async (): Promise<boolean> => {
    invalidateAppConfigCache();
    const config = await getAppConfig(true);
    if (config.librariansCanBorrow) {
      scanBlockedRef.current = false;
      return true;
    }

    let activeLoans = Number(profile?.activeBorrowCount) || 0;
    try {
      const me = await api.get("/api/auth/me");
      activeLoans = Number(me.data?.activeBorrowCount) || 0;
      void refresh().catch(() => {});
    } catch {
      // fall back to the cached count
    }

    const blocked = computeScanBlocked(config.librariansCanBorrow, activeLoans);
    scanBlockedRef.current = blocked;
    return !blocked;
  };

  return (
    <Tab.Navigator
      detachInactiveScreens={true}
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => <CustomTabBarButton {...props} />,
        tabBarActiveTintColor: mode === "dark" ? colors.amber : colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + bottomPad,
          paddingTop: 6,
          paddingBottom: bottomPad,
          elevation: 8,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              outline="home-outline"
              solid="home"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Catalog"
        component={CatalogStackNavigator}
        options={{
          title: "Catalog",
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              outline="library-outline"
              solid="library"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              outline="qr-code-outline"
              solid="qr-code"
            />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Not a gated user, or the gate is currently open: let the tab open
            // natively so there is no perceptible delay.
            if (profile?.role !== "librarian" || !scanBlockedRef.current) return;

            e.preventDefault();
            // Same tick as the press, so haptic and toast land together.
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
              () => {}
            );
            showToast("Borrowing is disabled for librarians.");

            // Confirm against the server; open Scan if the gate has since lifted.
            void revalidateScanGate().then((allowed) => {
              if (allowed) navigation.navigate("Scan");
            });
          },
        })}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          title: "Activity",
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              outline="time-outline"
              solid="time"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              size={size}
              outline="person-outline"
              solid="person"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setInitializing(false);
      if (u) {
        registerForPushNotifications().catch(() => {});
      }
    });
    return unsubscribe;
  }, []);

  if (initializing) {
    return <View style={[styles.boot, { backgroundColor: colors.cream }]} />;
  }

  return (
    <NavigationContainer>
      {user ? (
        <MainTabs />
      ) : (
        <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
          <AuthStackNav.Screen name="Login" component={LoginScreen} />
          <AuthStackNav.Screen name="Register" component={RegisterScreen} />
          <AuthStackNav.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen as React.ComponentType<any>}
          />
        </AuthStackNav.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1 },
});
