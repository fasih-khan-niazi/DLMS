import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import { registerForPushNotifications } from "../utils/notifications";
import { ProfileProvider } from "../context/ProfileContext";
import { useTheme } from "../theme";
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

  if (!focused) {
    return <Ionicons name={outline} size={size} color={color} />;
  }

  const glowColor = mode === "dark" ? colors.amber : colors.navy;

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        minWidth: 44,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        backgroundColor: mode === "dark" ? "rgba(232, 168, 56, 0.16)" : "rgba(26, 42, 62, 0.08)",
        shadowColor: glowColor,
        shadowOpacity: 0.45,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
      }}
    >
      <Ionicons name={solid} size={size} color={color} />
    </View>
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
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const { colors, mode } = useTheme();

  return (
    <ProfileProvider>
      <Tab.Navigator
        detachInactiveScreens={true}
        screenOptions={{
          headerShown: false,
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
    </ProfileProvider>
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
