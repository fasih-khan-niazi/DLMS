import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import api from "../config/api";
import { AppModal } from "../components/AppModal";
import { useToast } from "../components/AppToast";
import { AuthLayout, AuthLink, Button, Input } from "../components/ui";
import { useTheme } from "../theme";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type LockSheet = {
  title: string;
  message: string;
} | null;

function formatLockMinutes(seconds: number) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return m === 1 ? "1 minute" : `${m} minutes`;
}

export default function LoginScreen({ navigation }: Props) {
  const { colors, fontFamily, type, space } = useTheme();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [lockSheet, setLockSheet] = useState<LockSheet>(null);
  const [forgotPressed, setForgotPressed] = useState(false);

  const handleLogin = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setMissingOpen(true);
      return;
    }

    setLoading(true);
    try {
      const lockRes = await api.get("/api/auth/login-lock", { params: { email: trimmed } });
      if (lockRes.data?.locked) {
        const secs = Number(lockRes.data.lockedForSeconds) || 0;
        showToast(`Account locked. Try again in ${formatLockMinutes(secs)}.`);
        setLoading(false);
        return;
      }

      try {
        await signInWithEmailAndPassword(firebaseAuth, trimmed, password);
        await api.post("/api/auth/login-attempt", { email: trimmed, success: true }).catch(() => {});
      } catch (error: any) {
        const invalid =
          error.code === "auth/invalid-credential" ||
          error.code === "auth/wrong-password" ||
          error.code === "auth/user-not-found" ||
          error.code === "auth/invalid-email";

        if (!invalid) {
          showToast(error.message || "Could not sign in. Try again.");
          return;
        }

        const attempt = await api
          .post("/api/auth/login-attempt", { email: trimmed, success: false })
          .then((r) => r.data)
          .catch(() => null);

        if (attempt?.locked) {
          const secs = Number(attempt.lockedForSeconds) || 15 * 60;
          setLockSheet({
            title: "Account temporarily locked",
            message: `Too many incorrect sign-in attempts. Try again in ${formatLockMinutes(secs)}.`,
          });
          return;
        }

        const left = Number(attempt?.attemptsRemaining);
        if (Number.isFinite(left) && left > 0) {
          showToast(
            left === 1
              ? "Incorrect email or password. 1 attempt left."
              : `Incorrect email or password. ${left} attempts left.`
          );
        } else {
          showToast("Incorrect email or password.");
        }
      }
    } catch {
      showToast("Could not reach the server. Check your connection.");
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
          onPressIn={() => setForgotPressed(true)}
          onPressOut={() => setForgotPressed(false)}
          hitSlop={8}
          style={{
            alignSelf: "flex-end",
            marginTop: space.sm,
            marginBottom: space.md,
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 8,
            backgroundColor: forgotPressed ? "rgba(232, 168, 56, 0.22)" : "transparent",
          }}
        >
          <Text
            style={{
              color: forgotPressed ? colors.amberDark : colors.amberDark,
              fontSize: type.small,
              fontFamily: fontFamily.bodySemiBold,
              textDecorationLine: forgotPressed ? "underline" : "none",
            }}
          >
            Forgot password?
          </Text>
        </Pressable>

        <Button title="Sign in" onPress={handleLogin} loading={loading} />
      </AuthLayout>

      <AppModal
        visible={missingOpen}
        variant="info"
        title="Missing details"
        message="Enter your email and password to sign in."
        confirmLabel="OK"
        onClose={() => setMissingOpen(false)}
      />

      <AppModal
        visible={!!lockSheet}
        variant="danger"
        presentation="sheet"
        title={lockSheet?.title || ""}
        message={lockSheet?.message || ""}
        confirmLabel="OK"
        confirmVariant="dangerSoft"
        onClose={() => setLockSheet(null)}
      />
    </>
  );
}
