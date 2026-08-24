import React, { useCallback, useState } from "react";
import { Text, Pressable, Switch, View } from "react-native";
import { signOut } from "firebase/auth";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { firebaseAuth } from "../config/firebase";
import api from "../config/api";
import { useProfile } from "../context/ProfileContext";
import { AppModal } from "../components/AppModal";
import { Button, Card, Screen } from "../components/ui";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type HelpKind = "print" | "borrow" | null;

function SectionLabel({ children }: { children: string }) {
  const { colors, fontFamily, type, space } = useTheme();
  return (
    <Text
      style={{
        marginBottom: space.sm,
        marginTop: space.md,
        fontFamily: fontFamily.bodyBold,
        fontSize: type.caption,
        color: colors.muted,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}

function MenuRow({
  label,
  subtitle,
  icon,
  onPress,
  last,
  badge,
}: {
  label: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  last?: boolean;
  badge?: number;
}) {
  const { colors, fontFamily, type } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon ? (
        <Ionicons name={icon} size={20} color={colors.navy} style={{ marginRight: 12 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fontFamily.bodySemiBold,
            fontSize: type.body,
            color: colors.navy,
          }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: 2,
              fontFamily: fontFamily.body,
              fontSize: type.caption,
              color: colors.muted,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge && badge > 0 ? (
        <View
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.amber,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 5,
            marginRight: 8,
          }}
        >
          <Text
            style={{
              color: colors.navyDark,
              fontSize: 11,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            {badge > 9 ? "9+" : badge}
          </Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors, fontFamily, type } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
        {label}
      </Text>
      <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const { colors, fontFamily, space, type, mode, setMode } = useTheme();
  const { profile, isStaff } = useProfile();
  const [help, setHelp] = useState<HelpKind>(null);
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void api
        .get("/api/notifications/unread-count")
        .then((res) => setUnread(Number(res.data.unreadCount) || 0))
        .catch(() => {});
    }, [])
  );

  const displayName =
    profile?.displayName || firebaseAuth.currentUser?.displayName || "User";
  const email = profile?.email || firebaseAuth.currentUser?.email || "";
  const appVersion =
    Constants.expoConfig?.version || Constants.nativeAppVersion || "1.0.0";

  const openCatalog = useCallback(() => {
    setHelp(null);
    navigation.getParent()?.navigate("Catalog");
  }, [navigation]);

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 20 }}>
      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: type.title,
          color: colors.navy,
          marginBottom: space.sm,
        }}
      >
        Profile
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.body,
          fontSize: type.small,
          color: colors.muted,
          marginBottom: space.md,
        }}
      >
        Account, library activity, and preferences
      </Text>

      <SectionLabel>Account</SectionLabel>
      <Card style={{ marginBottom: space.sm }}>
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
      </Card>

      <SectionLabel>Library</SectionLabel>
      <Card padded={false} style={{ marginBottom: space.sm, paddingHorizontal: space.md }}>
        <StatRow label="Active loans" value={String(profile?.activeBorrowCount ?? 0)} />
        <StatRow
          label="Outstanding fines"
          value={`Rs ${profile?.totalOutstandingFines ?? 0}`}
          last
        />
      </Card>

      <SectionLabel>Preferences</SectionLabel>
      <Card padded={false} style={{ marginBottom: space.sm, paddingHorizontal: space.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.body,
                color: colors.navy,
              }}
            >
              Dark mode
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontFamily: fontFamily.body,
                fontSize: type.caption,
                color: colors.muted,
              }}
            >
              Easier on the eyes in low light
            </Text>
          </View>
          <Switch
            value={mode === "dark"}
            onValueChange={(on) => setMode(on ? "dark" : "light")}
            trackColor={{ false: colors.border, true: colors.amber }}
            thumbColor={mode === "dark" ? "#F8F7F4" : "#FFFFFF"}
          />
        </View>
        <MenuRow
          label="Notifications"
          subtitle="Inbox and alerts"
          icon="notifications-outline"
          badge={unread}
          onPress={() => navigation.navigate("Notifications")}
        />
        <MenuRow
          label="My Bookshelf"
          subtitle="Saved digital books"
          icon="bookmark-outline"
          onPress={() => navigation.navigate("Bookshelf")}
          last
        />
      </Card>

      {isStaff ? (
        <>
          <SectionLabel>Staff tools</SectionLabel>
          <Card padded={false} style={{ marginBottom: space.sm, paddingHorizontal: space.md }}>
            <MenuRow
              label="Add physical book"
              subtitle="ISBN lookup and copies"
              icon="book-outline"
              onPress={() => navigation.navigate("AddBook")}
            />
            <MenuRow
              label="Upload PDF"
              subtitle="Add a digital copy"
              icon="cloud-upload-outline"
              onPress={() => navigation.navigate("UploadDigitalBook")}
            />
            <MenuRow
              label="Print shelf labels"
              subtitle="QR labels from a book page"
              icon="print-outline"
              onPress={() => setHelp("print")}
              last
            />
          </Card>
        </>
      ) : null}

      <SectionLabel>Support</SectionLabel>
      <Card padded={false} style={{ marginBottom: space.lg, paddingHorizontal: space.md }}>
        <MenuRow
          label="How borrowing works"
          subtitle="Scan, return, fines"
          icon="help-circle-outline"
          onPress={() => setHelp("borrow")}
          last
        />
      </Card>

      <Button title="Sign out" variant="secondary" onPress={() => signOut(firebaseAuth)} />

      <Text
        style={{
          marginTop: space.lg,
          marginBottom: space.md,
          textAlign: "center",
          fontFamily: fontFamily.body,
          fontSize: type.caption,
          color: colors.muted,
        }}
      >
        DLMS · v{appVersion}
      </Text>

      <AppModal
        visible={help === "print"}
        variant="info"
        title="Print shelf labels"
        message="Open any physical book in Catalog, then use Print label on a copy. That creates a QR sticker you can share or print."
        confirmLabel="Open Catalog"
        cancelLabel="Close"
        onClose={() => setHelp(null)}
        onConfirm={openCatalog}
        onCancel={() => setHelp(null)}
      />

      <AppModal
        visible={help === "borrow"}
        variant="info"
        title="How borrowing works"
        message="Use Scan to borrow or return a physical copy. If a title is unavailable, reserve it from Catalog. Unpaid fines block new loans until cleared at the desk."
        confirmLabel="Got it"
        onClose={() => setHelp(null)}
      />
    </Screen>
  );
}
