import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { firebaseAuth } from "../config/firebase";
import api from "../config/api";
import { colors, radius, space, type } from "../theme";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function RegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password) {
      Alert.alert("Missing details", "Fill in name, email, and password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/register", {
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (error: any) {
      const message =
        error.response?.data?.error || error.message || "Registration failed";
      Alert.alert("Could not sign up", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.brand}>DLMS</Text>
          <Text style={styles.tagline}>Join as a student in under a minute</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Create account</Text>
          <Text style={styles.panelHint}>Staff roles are assigned by an admin later</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            value={displayName}
            onChangeText={setDisplayName}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@university.edu"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.link}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    justifyContent: "center",
  },
  hero: {
    marginBottom: space.lg,
    paddingHorizontal: space.sm,
  },
  brand: {
    fontSize: type.brand,
    fontWeight: "800",
    color: colors.white,
  },
  tagline: {
    marginTop: space.sm,
    fontSize: type.subtitle,
    color: "rgba(255,255,255,0.78)",
  },
  panel: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.navy,
  },
  panelHint: {
    marginTop: 4,
    marginBottom: space.md,
    color: colors.muted,
    fontSize: type.small,
  },
  label: {
    fontSize: type.small,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 6,
    marginTop: space.sm,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    fontSize: type.body,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: space.md,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: colors.white,
    fontSize: type.body,
    fontWeight: "700",
  },
  link: {
    textAlign: "center",
    color: colors.navy,
    fontSize: type.small,
    marginTop: space.md,
    fontWeight: "600",
  },
});
