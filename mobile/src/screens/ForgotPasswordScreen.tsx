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
import { sendPasswordResetEmail } from "firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { firebaseAuth } from "../config/firebase";
import { colors, radius, space, type } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ ForgotPassword: { email?: string } }, "ForgotPassword">;
};

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(route.params?.email || "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Email required", "Enter the email on your account.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, trimmed);
      setSent(true);
    } catch (error: any) {
      const code = error?.code || "";
      let message = error?.message || "Could not send reset email";
      if (code === "auth/user-not-found") {
        message = "No account found for that email.";
      } else if (code === "auth/invalid-email") {
        message = "That email address looks invalid.";
      } else if (code === "auth/too-many-requests") {
        message = "Too many attempts. Try again later.";
      }
      Alert.alert("Reset failed", message);
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
          <Text style={styles.tagline}>Reset your password securely</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Forgot password</Text>
          {sent ? (
            <>
              <Text style={styles.success}>
                If an account exists for {email.trim()}, Firebase has sent a password
                reset link. Check your inbox and spam folder, open the link, then
                choose a new password.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate("Login")}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>Back to sign in</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.panelHint}>
                We email you a secure link from Firebase Auth. No OTP codes in this
                MVP; the link is the industry-standard reset path.
              </Text>

              <Text style={styles.label}>Account email</Text>
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

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Send reset link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
                <Text style={styles.link}>Back to sign in</Text>
              </TouchableOpacity>
            </>
          )}
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
    marginBottom: space.sm,
  },
  panelHint: {
    marginBottom: space.md,
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 20,
  },
  success: {
    color: colors.text,
    fontSize: type.body,
    lineHeight: 24,
    marginBottom: space.lg,
  },
  label: {
    fontSize: type.small,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 6,
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
    marginBottom: space.md,
  },
  button: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
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
