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
import { colors, radius, space, type } from "../theme";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Enter email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (error: any) {
      const message =
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
          ? "Invalid email or password"
          : error.message || "Login failed";
      Alert.alert("Sign in failed", message);
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
          <Text style={styles.tagline}>Your campus library, in your pocket</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Sign in</Text>
          <Text style={styles.panelHint}>Students and staff use the same app</Text>

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
            placeholder="Your password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() })}
            hitSlop={8}
          >
            <Text style={styles.forgot}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Register")} hitSlop={8}>
            <Text style={styles.link}>New here? Create a student account</Text>
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
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: space.sm,
    fontSize: type.subtitle,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 22,
  },
  panel: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
  forgot: {
    alignSelf: "flex-end",
    marginTop: space.sm,
    marginBottom: space.md,
    color: colors.amberDark,
    fontSize: type.small,
    fontWeight: "600",
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
