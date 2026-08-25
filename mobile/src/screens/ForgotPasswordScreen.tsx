import React, { useState } from "react";
import { Text } from "react-native";
import { sendPasswordResetEmail } from "firebase/auth";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { firebaseAuth } from "../config/firebase";
import { AppModal } from "../components/AppModal";
import { AuthLayout, AuthLink, Button, Input } from "../components/ui";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ ForgotPassword: { email?: string } }, "ForgotPassword">;
};

type Feedback = {
  variant: "error" | "info" | "success";
  title: string;
  message: string;
} | null;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const { colors, fontFamily, type, space } = useTheme();
  const [email, setEmail] = useState(route.params?.email || "");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setFeedback({
        variant: "info",
        title: "Email required",
        message: "Enter the email on your account.",
      });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, trimmed);
      setFeedback({
        variant: "success",
        title: "Check your email",
        message: `If an account exists for ${trimmed}, Firebase sent a password reset link. Check inbox and spam, then choose a new password.`,
      });
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
      setFeedback({
        variant: "error",
        title: "Reset failed",
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthLayout
        brandLine="Reset your password securely"
        panelTitle="Forgot password"
        panelHint="We email you a secure Firebase reset link"
        footer={
          <AuthLink label="Back to sign in" onDark onPress={() => navigation.goBack()} />
        }
      >
        <Text
          style={{
            marginBottom: space.md,
            color: colors.muted,
            fontSize: type.small,
            fontFamily: fontFamily.body,
            lineHeight: 20,
          }}
        >
          Open the link in your inbox to choose a new password.
        </Text>

        <Input
          label="Account email"
          placeholder="you@university.edu"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />

        <Button
          title="Send reset link"
          onPress={handleReset}
          loading={loading}
          style={{ marginTop: space.sm }}
        />
      </AuthLayout>

      <AppModal
        visible={!!feedback}
        variant={feedback?.variant || "info"}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        confirmLabel={feedback?.variant === "success" ? "Back to sign in" : "OK"}
        onClose={() => {
          const goLogin = feedback?.variant === "success";
          setFeedback(null);
          if (goLogin) navigation.navigate("Login");
        }}
      />
    </>
  );
}
