import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, User } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import { registerForPushNotifications } from "../utils/notifications";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import CatalogScreen from "../screens/CatalogScreen";
import BookDetailScreen from "../screens/BookDetailScreen";
import AddBookScreen from "../screens/AddBookScreen";
import MyLoansScreen from "../screens/MyLoansScreen";
import ScanScreen from "../screens/ScanScreen";
import ReservationsScreen from "../screens/ReservationsScreen";
import DigitalLibraryScreen from "../screens/DigitalLibraryScreen";
import DigitalBookDetailScreen from "../screens/DigitalBookDetailScreen";
import BookshelfScreen from "../screens/BookshelfScreen";
import UploadDigitalBookScreen from "../screens/UploadDigitalBookScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      if (initializing) setInitializing(false);
      if (u) {
        registerForPushNotifications().catch(() => {});
      }
    });
    return unsubscribe;
  }, []);

  if (initializing) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Catalog" component={CatalogScreen} />
            <Stack.Screen name="BookDetail" component={BookDetailScreen} />
            <Stack.Screen name="AddBook" component={AddBookScreen} />
            <Stack.Screen name="MyLoans" component={MyLoansScreen} />
            <Stack.Screen name="Reservations" component={ReservationsScreen} />
            <Stack.Screen name="Scan" component={ScanScreen} />
            <Stack.Screen name="DigitalLibrary" component={DigitalLibraryScreen} />
            <Stack.Screen name="DigitalBookDetail" component={DigitalBookDetailScreen} />
            <Stack.Screen name="Bookshelf" component={BookshelfScreen} />
            <Stack.Screen name="UploadDigitalBook" component={UploadDigitalBookScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
