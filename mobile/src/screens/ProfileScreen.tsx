import React, { useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { signOut } from "firebase/auth";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { firebaseAuth } from "../config/firebase";
import api, { API_BASE_URL } from "../config/api";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((res) => setProfile(res.data))
      .catch(() => {});
  }, []);

  const isStaff = profile?.role === "librarian" || profile?.role === "admin";

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: Math.max(insets.top, 24) + 12 },
      ]}
    >
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.name}>
        {profile?.displayName || firebaseAuth.currentUser?.displayName || "User"}
      </Text>
      <Text style={styles.meta}>{profile?.email || firebaseAuth.currentUser?.email}</Text>
      <Text style={styles.meta}>Role: {profile?.role || "..."}</Text>
      <Text style={styles.meta}>
        Active loans: {profile?.activeBorrowCount ?? 0}
      </Text>
      <Text style={styles.meta}>
        Outstanding fines: Rs {profile?.totalOutstandingFines ?? 0}
      </Text>
      <Text style={styles.apiHint}>API: {API_BASE_URL}</Text>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.navigate("DigitalLibrary")}
      >
        <Text style={styles.linkText}>E-Library</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.navigate("Bookshelf")}
      >
        <Text style={styles.linkText}>My Bookshelf</Text>
      </TouchableOpacity>

      {isStaff && (
        <>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate("AddBook")}
          >
            <Text style={styles.linkText}>Add Physical Book</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate("UploadDigitalBook")}
          >
            <Text style={styles.linkText}>Upload PDF</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => signOut(firebaseAuth)}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8F7F4",
    paddingHorizontal: 28,
    paddingBottom: 48,
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2E4A62",
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2E4A62",
  },
  meta: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 6,
  },
  apiHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
    marginBottom: 20,
  },
  linkButton: {
    backgroundColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  linkText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  logoutButton: {
    marginTop: 16,
    backgroundColor: "#E8A838",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
