import React, { useState } from "react";
import { Alert, Text } from "react-native";
import { sendPasswordResetEmail } from "firebase/auth";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { firebaseAuth } from "../config/firebase";
import { AuthLayout, AuthLink, Button, Input } from "../components/ui";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ ForgotPassword: { email?: string } }, "ForgotPassword">;
};

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const { colors, fontFamily, type, space } = useTheme();
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
    <AuthLayout brandLine="Reset your password securely" panelTitle="Forgot password">
      {sent ? (
        <>
          <Text
            style={{
              color: colors.text,
              fontSize: type.body,
              fontFamily: fontFamily.body,
              lineHeight: 24,
              marginBottom: space.lg,
            }}
          >
            If an account exists for {email.trim()}, Firebase has sent a password reset link.
            Check your inbox and spam folder, open the link, then choose a new password.
          </Text>
          <Button title="Back to sign in" onPress={() => navigation.navigate("Login")} />
        </>
      ) : (
        <>
          <Text
            style={{
              marginBottom: space.md,
              color: colors.muted,
              fontSize: type.small,
              fontFamily: fontFamily.body,
              lineHeight: 20,
            }}
          >
            We email you a secure link from Firebase Auth. Open the link in your inbox to choose a
            new password.
          </Text>

          <Input
            label="Account email"
            placeholder="you@university.edu"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Button
            title="Send reset link"
            onPress={handleReset}
            loading={loading}
            style={{ marginTop: space.sm }}
          />

          <AuthLink label="Back to sign in" onPress={() => navigation.goBack()} />
        </>
      )}
    </AuthLayout>
  );
}
