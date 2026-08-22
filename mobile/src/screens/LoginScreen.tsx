import React, { useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import { AuthLayout, AuthLink, Button, Input } from "../components/ui";
import { useTheme } from "../theme";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function LoginScreen({ navigation }: Props) {
  const { colors, fontFamily, type, space } = useTheme();
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
    <AuthLayout
      brandLine="Your campus library, in your pocket"
      panelTitle="Sign in"
      panelHint="Students and staff use the same app"
      footer={
        <AuthLink
          label="New here? Create a student account"
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
      />

      <Input
        label="Password"
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
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
  );
}
