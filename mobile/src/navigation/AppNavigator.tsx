import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onAuthStateChanged, User } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import { registerForPushNotifications } from "../utils/notifications";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import CatalogScreen from "../screens/CatalogScreen";
import BookDetailScreen from "../screens/BookDetailScreen";
import AddBookScreen from "../screens/AddBookScreen";
import ScanScreen from "../screens/ScanScreen";
import ActivityScreen from "../screens/ActivityScreen";
import ProfileScreen from "../screens/ProfileScreen";
import DigitalLibraryScreen from "../screens/DigitalLibraryScreen";
import DigitalBookDetailScreen from "../screens/DigitalBookDetailScreen";
import BookshelfScreen from "../screens/BookshelfScreen";
import UploadDigitalBookScreen from "../screens/UploadDigitalBookScreen";

const AuthStackNav = createNativeStackNavigator();
const HomeStackNav = createNativeStackNavigator();
const CatalogStackNav = createNativeStackNavigator();
const ProfileStackNav = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.tabIconWrap}>
      <Text style={[styles.tabIcon, { color }]}>{label}</Text>
    </View>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <HomeStackNav.Screen name="HomeMain" component={HomeScreen} />
      <HomeStackNav.Screen name="DigitalLibrary" component={DigitalLibraryScreen} />
      <HomeStackNav.Screen
        name="DigitalBookDetail"
        component={DigitalBookDetailScreen as React.ComponentType<any>}
      />
      <HomeStackNav.Screen name="Bookshelf" component={BookshelfScreen} />
      <HomeStackNav.Screen name="AddBook" component={AddBookScreen} />
      <HomeStackNav.Screen name="UploadDigitalBook" component={UploadDigitalBookScreen} />
    </HomeStackNav.Navigator>
  );
}

function CatalogStackNavigator() {
  return (
    <CatalogStackNav.Navigator screenOptions={{ headerShown: false }}>
      <CatalogStackNav.Screen name="CatalogMain" component={CatalogScreen} />
      <CatalogStackNav.Screen
        name="BookDetail"
        component={BookDetailScreen as React.ComponentType<any>}
      />
    </CatalogStackNav.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStackNav.Screen name="DigitalLibrary" component={DigitalLibraryScreen} />
      <ProfileStackNav.Screen
        name="DigitalBookDetail"
        component={DigitalBookDetailScreen as React.ComponentType<any>}
      />
      <ProfileStackNav.Screen name="Bookshelf" component={BookshelfScreen} />
      <ProfileStackNav.Screen name="AddBook" component={AddBookScreen} />
      <ProfileStackNav.Screen name="UploadDigitalBook" component={UploadDigitalBookScreen} />
    </ProfileStackNav.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2E4A62",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E1D8",
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
          tabBarIcon: ({ color }) => <TabIcon label="H" color={color} />,
        }}
      />
      <Tab.Screen
        name="Catalog"
        component={CatalogStackNavigator}
        options={{
          title: "Catalog",
          tabBarIcon: ({ color }) => <TabIcon label="C" color={color} />,
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          title: "Scan",
          tabBarIcon: ({ color }) => <TabIcon label="S" color={color} />,
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          title: "Activity",
          tabBarIcon: ({ color }) => <TabIcon label="A" color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon label="P" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

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
    return <View style={styles.boot} />;
  }

  return (
    <NavigationContainer>
      {user ? (
        <MainTabs />
      ) : (
        <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
          <AuthStackNav.Screen name="Login" component={LoginScreen} />
          <AuthStackNav.Screen name="Register" component={RegisterScreen} />
        </AuthStackNav.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: "#F8F7F4" },
  tabIconWrap: {
    width: 28,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIcon: {
    fontSize: 13,
    fontWeight: "800",
  },
});
