import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { colors, radius, space, type } from "../theme";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  sentAt: string | null;
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/api/notifications");
      setItems(res.data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [])
  );

  const markOne = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Could not update");
    }
  };

  const markAll = async () => {
    try {
      await api.post("/api/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Could not update");
    }
  };

  const formatWhen = (value: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Notifications</Text>
        <TouchableOpacity onPress={markAll} hitSlop={8}>
          <Text style={styles.markAll}>Mark all</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        In-app alerts for dues, overdue books, and reservation ready notices.
        System push banners need a dedicated app build later.
      </Text>

      {loading ? (
        <SkeletonList rows={6} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.navy}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No notifications yet"
              message="When loans are due or a reservation is ready, they will show up here."
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.read && styles.cardUnread]}
              onPress={() => {
                if (!item.read) markOne(item.id);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {!item.read ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardMeta}>
                {item.type}
                {item.sentAt ? ` · ${formatWhen(item.sentAt)}` : ""}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  back: {
    color: colors.amberDark,
    fontWeight: "700",
    width: 64,
  },
  heading: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.navy,
  },
  markAll: {
    color: colors.navy,
    fontWeight: "600",
    fontSize: type.small,
    width: 64,
    textAlign: "right",
  },
  hint: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 18,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: {
    borderColor: colors.amber,
    backgroundColor: "#FFFBF3",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.amber,
  },
  cardBody: {
    marginTop: 6,
    color: colors.text,
    fontSize: type.body,
    lineHeight: 22,
  },
  cardMeta: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
  },
});
