import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
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

export default function LoginScreen({ navigation }: Props) {
  const { colors, fontFamily, type, space } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setFeedback({
        variant: "info",
        title: "Missing details",
        message: "Enter your email and password to sign in.",
      });
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (error: any) {
      const invalid =
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/invalid-email";
      setFeedback({
        variant: "error",
        title: invalid ? "Invalid password" : "Sign in failed",
        message: invalid
          ? "That email or password is not correct. Try again, or reset your password."
          : error.message || "Could not sign in. Try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthLayout
        brandLine="Your campus library, in your pocket"
        panelTitle="Sign in"
        panelHint="Students and staff use the same app"
        footer={
          <AuthLink
            label="New here? Create a student account"
            onDark
            onPress={() => navigation.navigate("Register")}
          />
        }
      >
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
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          passwordToggle
          autoComplete="password"
          textContentType="password"
        />

        <Pressable
          onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() })}
          hitSlop={8}
          style={{ alignSelf: "flex-end", marginTop: space.sm, marginBottom: space.md }}
        >
          <Text
            style={{
              color: colors.amberDark,
              fontSize: type.small,
              fontFamily: fontFamily.bodySemiBold,
            }}
          >
            Forgot password?
          </Text>
        </Pressable>

        <Button title="Sign in" onPress={handleLogin} loading={loading} />
      </AuthLayout>

      <AppModal
        visible={!!feedback}
        variant={feedback?.variant || "error"}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        confirmLabel="Try again"
        onClose={() => setFeedback(null)}
      />
    </>
  );
}
