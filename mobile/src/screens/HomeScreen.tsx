import React, { useCallback, useState } from "react";
import { Text, View, Pressable } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../config/api";
import { firebaseAuth } from "../config/firebase";
import { useProfile } from "../context/ProfileContext";
import { Card, Screen } from "../components/ui";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

function PlaceholderSection({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const { colors, fontFamily, type, space } = useTheme();

  return (
    <Card style={{ marginBottom: space.md }}>
      <Text
        style={{
          fontFamily: fontFamily.bodyBold,
          fontSize: type.body,
          color: colors.navy,
          marginBottom: space.sm,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.body,
          fontSize: type.small,
          color: colors.muted,
          lineHeight: 20,
        }}
      >
        {message}
      </Text>
    </Card>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { colors, fontFamily, radius, space, type } = useTheme();
  const { profile } = useProfile();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      api
        .get("/api/notifications/unread-count")
        .then((res) => setUnread(Number(res.data.unreadCount) || 0))
        .catch(() => setUnread(0));
    }, [])
  );

  const displayName =
    profile?.displayName || firebaseAuth.currentUser?.displayName || "there";

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 20 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: space.md,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamily.display,
            fontSize: type.title,
            color: colors.navy,
          }}
        >
          DLMS
        </Text>
        <Pressable
          onPress={() => navigation.navigate("Notifications")}
          hitSlop={8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.pill,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.navy} />
          {unread > 0 ? (
            <View
              style={{
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.amber,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 4,
              }}
            >
              <Text
                style={{
                  color: colors.navyDark,
                  fontSize: 10,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {unread > 9 ? "9+" : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: type.titleSm,
          color: colors.navy,
          marginBottom: space.lg,
        }}
      >
        Hello, {displayName}
      </Text>

      <PlaceholderSection
        title="At a glance"
        message="Active loans, overdue warnings, fines, and reservation alerts will show here."
      />
      <PlaceholderSection
        title="Quick actions"
        message="Shortcuts to scan, search the catalog, and pick up where you left off."
      />
      <PlaceholderSection
        title="Continue reading"
        message="E-books you have started will appear here."
      />
    </Screen>
  );
}
