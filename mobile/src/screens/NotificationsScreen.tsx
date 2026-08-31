import React, { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { SkeletonList } from "../components/Skeleton";
import { Badge, ErrorState, ScreenHeader, PressableScale } from "../components/ui";
import { useTheme } from "../theme";
import {
  formatNoticeTime,
  openNotificationTarget,
  typeLabel,
  typeTone,
  type InboxNotification,
} from "../utils/notificationNav";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, fontFamily, radius, space, type, mode } = useTheme();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = items.filter((n) => !n.read).length;

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/notifications");
      setItems(res.data.items || []);
    } catch {
      setError("Could not load notifications.");
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [])
  );

  const markOne = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // still allow navigation
    }
  };

  const markAll = async () => {
    if (unreadCount === 0) return;
    try {
      await api.post("/api/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // keep current state
    }
  };

  const onPressItem = async (item: InboxNotification) => {
    if (!item.read) await markOne(item.id);
    openNotificationTarget(navigation, item);
  };

  const unreadBg = mode === "dark" ? "#2A3324" : "#FFFBF3";

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenHeader
          title="Notifications"
          onBack={() => navigation.goBack()}
          right={
            unreadCount > 0 ? (
              <PressableScale onPress={() => void markAll()} hitSlop={10} haptic="selection">
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.caption,
                    color: colors.amberDark,
                  }}
                >
                  Mark all read
                </Text>
              </PressableScale>
            ) : (
              <View />
            )
          }
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 20 }}>
          <SkeletonList rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              tintColor={colors.navy}
            />
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 48, alignItems: "center", paddingHorizontal: 24 }}>
              <Text
                style={{
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.titleSm,
                  color: colors.navy,
                  textAlign: "center",
                }}
              >
                No notifications yet
              </Text>
              <Text
                style={{
                  marginTop: space.sm,
                  fontFamily: fontFamily.body,
                  fontSize: type.small,
                  color: colors.muted,
                  textAlign: "center",
                  lineHeight: 20,
                }}
              >
                Due dates, overdue books, and ready reservations will show up here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => void onPressItem(item)}
              style={{
                backgroundColor: item.read ? colors.white : unreadBg,
                borderRadius: radius.lg,
                padding: 16,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: item.read ? colors.border : colors.amber,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Badge label={typeLabel(item.type)} tone={typeTone(item.type)} />
                {!item.read ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.amber,
                    }}
                  />
                ) : null}
                <Text
                  style={{
                    marginLeft: "auto",
                    fontFamily: fontFamily.body,
                    fontSize: type.caption,
                    color: colors.muted,
                  }}
                >
                  {formatNoticeTime(item.sentAt)}
                </Text>
              </View>
              <Text
                style={{
                  marginTop: 8,
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.body,
                  color: colors.navy,
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontFamily: fontFamily.body,
                  fontSize: type.small,
                  color: colors.text,
                  lineHeight: 20,
                }}
              >
                {item.body}
              </Text>
            </PressableScale>
          )}
        />
      )}
    </View>
  );
}
