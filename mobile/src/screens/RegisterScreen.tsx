import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import api from "../config/api";
import { AppModal } from "../components/AppModal";
import { AuthLayout, AuthLink, Button, Input } from "../components/ui";
import { useTheme } from "../theme";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type Feedback = {
  variant: "error" | "info";
  title: string;
  message: string;
} | null;

export default function RegisterScreen({ navigation }: Props) {
  const { space } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password) {
      setFeedback({
        variant: "info",
        title: "Missing details",
        message: "Fill in your name, email, and password.",
      });
      return;
    }

    if (password.length < 8) {
      setFeedback({
        variant: "error",
        title: "Weak password",
        message: "Use at least 8 characters for your password.",
      });
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
      setFeedback({
        variant: "error",
        title: "Could not sign up",
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthLayout
        brandLine="Join as a student in under a minute"
        panelTitle="Create account"
        panelHint="Staff roles are assigned by an admin later"
        footer={
          <AuthLink
            label="Already have an account? Sign in"
            onDark
            onPress={() => navigation.goBack()}
          />
        }
      >
        <Input
          label="Full name"
          placeholder="Your name"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          textContentType="name"
        />

        <Input
          label="Email"
          placeholder="you@university.edu"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />

        <Input
          label="Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          passwordToggle
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Button
          title="Create account"
          onPress={handleRegister}
          loading={loading}
          style={{ marginTop: space.md }}
        />
      </AuthLayout>

      <AppModal
        visible={!!feedback}
        variant={feedback?.variant || "error"}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        confirmLabel="OK"
        onClose={() => setFeedback(null)}
      />
    </>
  );
}
