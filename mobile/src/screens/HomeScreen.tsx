import React, { useCallback, useState } from "react";
import { Text, StyleSheet, TouchableOpacity, ScrollView, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";
import { colors, radius, space, type } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      api
        .get("/api/auth/me")
        .then((res) => setProfile(res.data))
        .catch(() => {});
      api
        .get("/api/notifications/unread-count")
        .then((res) => setUnread(Number(res.data.unreadCount) || 0))
        .catch(() => setUnread(0));
    }, [])
  );

  const isStaff = profile?.role === "librarian" || profile?.role === "admin";

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: Math.max(insets.top, 24) + 12 },
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.brand}>DLMS</Text>
        <TouchableOpacity
          style={styles.bell}
          onPress={() => navigation.navigate("Notifications")}
          activeOpacity={0.85}
        >
          <Text style={styles.bellText}>Alerts</Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>
        Hello, {profile?.displayName || firebaseAuth.currentUser?.displayName || "User"}
      </Text>
      <Text style={styles.role}>Role: {profile?.role || "loading..."}</Text>
      <Text style={styles.apiHint}>API: {API_BASE_URL}</Text>

      <Text style={styles.section}>Digital</Text>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("DigitalLibrary")}
        activeOpacity={0.85}
      >
        <Text style={styles.actionText}>E-Library</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("Bookshelf")}
        activeOpacity={0.85}
      >
        <Text style={styles.actionText}>My Bookshelf</Text>
      </TouchableOpacity>

      {isStaff && (
        <>
          <Text style={styles.section}>Staff</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("AddBook")}
            activeOpacity={0.85}
          >
            <Text style={styles.actionText}>Add Physical Book</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("UploadDigitalBook")}
            activeOpacity={0.85}
          >
            <Text style={styles.actionText}>Upload PDF</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cream,
    paddingHorizontal: 28,
    paddingBottom: 48,
    flexGrow: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.navy,
  },
  bell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bellText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: type.small,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.navyDark,
    fontSize: 10,
    fontWeight: "800",
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.navy,
  },
  role: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 6,
  },
  apiHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    marginBottom: 20,
  },
  section: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 10,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  actionButton: {
    width: "100%",
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  actionText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
