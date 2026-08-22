import React, { useState } from "react";
import { Alert } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import api from "../config/api";
import { AuthLayout, AuthLink, Button, Input } from "../components/ui";
import { useTheme } from "../theme";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function RegisterScreen({ navigation }: Props) {
  const { space } = useTheme();
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
    <AuthLayout
      brandLine="Join as a student in under a minute"
      panelTitle="Create account"
      panelHint="Staff roles are assigned by an admin later"
      footer={
        <AuthLink label="Already have an account? Sign in" onPress={() => navigation.goBack()} />
      }
    >
      <Input label="Full name" placeholder="Your name" value={displayName} onChangeText={setDisplayName} />

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
        placeholder="At least 6 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button
        title="Create account"
        onPress={handleRegister}
        loading={loading}
        style={{ marginTop: space.md }}
      />
    </AuthLayout>
  );
}
