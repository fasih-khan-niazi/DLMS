import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import * as Device from "expo-device";
import Constants from "expo-constants";
import api from "../config/api";

// Expo Go mein static import crash karta hai (SDK 53+) - yahan dynamic import
export async function registerForPushNotifications(): Promise<string | null> {
  if (isRunningInExpoGo()) {
    console.log("Push notifications skipped in Expo Go (use a development build for push)");
    return null;
  }

  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  try {
    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("loans", {
        name: "Loans and due dates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#E8A838",
      });
      await Notifications.setNotificationChannelAsync("reservations", {
        name: "Reservations",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#E8A838",
      });
      await Notifications.setNotificationChannelAsync("default", {
        name: "Library updates",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    // push token le kar server pe register
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenResponse.data;

    try {
      await api.post("/api/auth/fcm-token", { token });
    } catch (error) {
      console.error("Failed to register push token with API:", error);
    }

    return token;
  } catch (error) {
    console.error("Push token registration skipped:", error);
    return null;
  }
}
