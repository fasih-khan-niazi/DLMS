import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { signOut } from "firebase/auth";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { firebaseAuth } from "../config/firebase";
import api, { API_BASE_URL } from "../config/api";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function HomeScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((res) => setProfile(res.data))
      .catch(() => {});
  }, []);

  const isStaff = profile?.role === "librarian" || profile?.role === "admin";

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Hello, {profile?.displayName || firebaseAuth.currentUser?.displayName || "User"}
      </Text>
      <Text style={styles.role}>Role: {profile?.role || "loading..."}</Text>
      <Text style={styles.apiHint}>API: {API_BASE_URL}</Text>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("Catalog")}
      >
        <Text style={styles.actionText}>Browse Catalog</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("Scan")}
      >
        <Text style={styles.actionText}>Scan QR (Borrow / Return)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("MyLoans")}
      >
        <Text style={styles.actionText}>My Loans</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("Reservations")}
      >
        <Text style={styles.actionText}>My Reservations</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("DigitalLibrary")}
      >
        <Text style={styles.actionText}>E-Library</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("Bookshelf")}
      >
        <Text style={styles.actionText}>My Bookshelf</Text>
      </TouchableOpacity>

      {isStaff && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("AddBook")}
        >
          <Text style={styles.actionText}>Add Book</Text>
        </TouchableOpacity>
      )}

      {isStaff && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("UploadDigitalBook")}
        >
          <Text style={styles.actionText}>Upload PDF</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => signOut(firebaseAuth)}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7F4",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2E4A62",
  },
  role: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
  },
  apiHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    marginBottom: 24,
  },
  actionButton: {
    width: "100%",
    backgroundColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  logoutButton: {
    marginTop: 20,
    backgroundColor: "#E8A838",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
