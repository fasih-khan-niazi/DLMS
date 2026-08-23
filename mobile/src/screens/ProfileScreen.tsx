import React from "react";
import { Text, Pressable, View } from "react-native";
import { signOut } from "firebase/auth";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { firebaseAuth } from "../config/firebase";
import { useProfile } from "../context/ProfileContext";
import { Button, Card, Screen } from "../components/ui";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, fontFamily, type, space } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: fontFamily.bodySemiBold,
          fontSize: type.body,
          color: colors.navy,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const { profile, isStaff } = useProfile();

  const displayName =
    profile?.displayName || firebaseAuth.currentUser?.displayName || "User";
  const email = profile?.email || firebaseAuth.currentUser?.email || "";

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 20 }}>
      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: type.title,
          color: colors.navy,
          marginBottom: space.md,
        }}
      >
        Profile
      </Text>

      <Card style={{ marginBottom: space.md }}>
        <Text
          style={{
            fontFamily: fontFamily.bodyBold,
            fontSize: type.titleSm,
            color: colors.navy,
          }}
        >
          {displayName}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontFamily: fontFamily.body,
            fontSize: type.small,
            color: colors.muted,
          }}
        >
          {email}
        </Text>
        <Text
          style={{
            marginTop: space.sm,
            fontFamily: fontFamily.body,
            fontSize: type.small,
            color: colors.text,
          }}
        >
          Active loans: {profile?.activeBorrowCount ?? 0}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontFamily: fontFamily.body,
            fontSize: type.small,
            color: colors.text,
          }}
        >
          Outstanding fines: Rs {profile?.totalOutstandingFines ?? 0}
        </Text>
      </Card>

      <Card padded={false} style={{ marginBottom: space.md, paddingHorizontal: space.md }}>
        <MenuRow label="Notifications" onPress={() => navigation.navigate("Notifications")} />
        <MenuRow label="My Bookshelf" onPress={() => navigation.navigate("Bookshelf")} />
        {isStaff ? (
          <>
            <MenuRow label="Add physical book" onPress={() => navigation.navigate("AddBook")} />
            <MenuRow
              label="Upload PDF"
              onPress={() => navigation.navigate("UploadDigitalBook")}
            />
          </>
        ) : null}
      </Card>

      <Button title="Sign out" variant="secondary" onPress={() => signOut(firebaseAuth)} />
    </Screen>
  );
}
