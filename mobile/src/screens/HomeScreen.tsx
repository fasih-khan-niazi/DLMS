import React, { useCallback, useState } from "react";
import { Text, View, Pressable, ScrollView } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../config/api";
import { firebaseAuth } from "../config/firebase";
import { useProfile } from "../context/ProfileContext";
import { SearchBar } from "../components/SearchBar";
import { Card, Screen } from "../components/ui";
import { useTheme } from "../theme";
import {
  getDashboardCache,
  setDashboardCache,
  type DashboardSnapshot,
} from "../utils/dashboardCache";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const fn = (value as { toMillis?: () => number }).toMillis;
    if (typeof fn === "function") return fn.call(value);
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

export default function HomeScreen({ navigation }: Props) {
  const { colors, fontFamily, radius, space, type } = useTheme();
  const { profile } = useProfile();
  const [unread, setUnread] = useState(0);
  const [quickSearch, setQuickSearch] = useState("");
  const [summary, setSummary] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    const cached = await getDashboardCache();
    if (cached) setSummary(cached);

    try {
      const [loansRes, resRes, shelfRes, unreadRes] = await Promise.all([
        api.get("/api/loans/mine", { params: { status: "active" } }),
        api.get("/api/reservations/mine"),
        api.get("/api/digital-books/bookshelf/mine"),
        api.get("/api/notifications/unread-count"),
      ]);

      const now = Date.now();
      const loans = loansRes.data.loans || [];
      const overdueLoans = loans.filter((loan: any) => {
        if (loan.status === "overdue") return true;
        const due = toMs(loan.dueDate);
        return due > 0 && due < now;
      }).length;

      const reservations = resRes.data.reservations || [];
      const readyReservations = reservations.filter((r: any) => r.status === "ready").length;

      const continueReading = (shelfRes.data.items || [])
        .filter((item: any) => Number(item.progress) > 0)
        .slice(0, 6)
        .map((item: any) => ({
          digitalBookId: item.digitalBookId,
          title: item.title,
          author: item.author,
          progress: Number(item.progress) || 0,
        }));

      const snapshot: DashboardSnapshot = {
        activeLoans: loans.length,
        overdueLoans,
        readyReservations,
        outstandingFines: profile?.totalOutstandingFines ?? 0,
        continueReading,
        fetchedAt: Date.now(),
      };

      setSummary(snapshot);
      await setDashboardCache(snapshot);
      setUnread(Number(unreadRes.data.unreadCount) || 0);
    } catch {
      if (!cached) {
        setSummary({
          activeLoans: profile?.activeBorrowCount ?? 0,
          overdueLoans: 0,
          readyReservations: 0,
          outstandingFines: profile?.totalOutstandingFines ?? 0,
          continueReading: [],
          fetchedAt: Date.now(),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.activeBorrowCount, profile?.totalOutstandingFines]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDashboard();
    }, [loadDashboard])
  );

  const displayName =
    profile?.displayName || firebaseAuth.currentUser?.displayName || "there";

  const openUnifiedSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    navigation.navigate("UnifiedSearch", { query: trimmed });
  };

  const goToScan = () => navigation.getParent()?.navigate("Scan");
  const goToCatalog = () => navigation.getParent()?.navigate("Catalog");
  const goToActivity = () => navigation.getParent()?.navigate("Activity");

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

      <View style={{ marginBottom: space.lg }}>
        <SearchBar
          value={quickSearch}
          onChangeText={setQuickSearch}
          onSearch={openUnifiedSearch}
          searchOnDebounce={false}
          showRecent
          hint="Physical and digital copies."
          placeholder="Search the library"
        />
      </View>

      <Card style={{ marginBottom: space.md }}>
        <Text
          style={{
            fontFamily: fontFamily.bodyBold,
            fontSize: type.body,
            color: colors.navy,
            marginBottom: space.sm,
          }}
        >
          At a glance
        </Text>
        {loading && !summary ? (
          <Text style={{ fontFamily: fontFamily.body, color: colors.muted, fontSize: type.small }}>
            Loading your library summary...
          </Text>
        ) : (
          <View style={{ gap: space.sm }}>
            <Pressable onPress={goToActivity}>
              <Text style={{ fontFamily: fontFamily.body, fontSize: type.body, color: colors.text }}>
                {summary?.activeLoans ?? 0} active loan{(summary?.activeLoans ?? 0) === 1 ? "" : "s"}
              </Text>
            </Pressable>
            {(summary?.overdueLoans ?? 0) > 0 ? (
              <Pressable onPress={goToActivity}>
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.body,
                    color: colors.danger,
                  }}
                >
                  {summary?.overdueLoans} overdue — return soon
                </Text>
              </Pressable>
            ) : null}
            {(summary?.readyReservations ?? 0) > 0 ? (
              <Pressable onPress={goToActivity}>
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.body,
                    color: colors.amberDark,
                  }}
                >
                  {summary?.readyReservations} reservation ready for pickup
                </Text>
              </Pressable>
            ) : null}
            {(summary?.outstandingFines ?? 0) > 0 ? (
              <Text style={{ fontFamily: fontFamily.body, fontSize: type.body, color: colors.text }}>
                Outstanding fines: Rs {summary?.outstandingFines}
              </Text>
            ) : null}
            {!summary?.overdueLoans &&
            !summary?.readyReservations &&
            !(summary?.outstandingFines ?? 0) &&
            !(summary?.activeLoans ?? 0) ? (
              <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
                All clear. Browse the catalog or scan a book to get started.
              </Text>
            ) : null}
          </View>
        )}
      </Card>

      <Card style={{ marginBottom: space.md }}>
        <Text
          style={{
            fontFamily: fontFamily.bodyBold,
            fontSize: type.body,
            color: colors.navy,
            marginBottom: space.sm,
          }}
        >
          Quick actions
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            { label: "Scan", icon: "qr-code-outline" as const, onPress: goToScan },
            { label: "Catalog", icon: "library-outline" as const, onPress: goToCatalog },
            {
              label: "Search",
              icon: "search-outline" as const,
              onPress: () => openUnifiedSearch(quickSearch),
            },
          ].map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.white,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.pill,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Ionicons name={action.icon} size={16} color={colors.navy} />
              <Text
                style={{
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.small,
                  color: colors.navy,
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={{ marginBottom: space.md }}>
        <Text
          style={{
            fontFamily: fontFamily.bodyBold,
            fontSize: type.body,
            color: colors.navy,
            marginBottom: space.sm,
          }}
        >
          Continue reading
        </Text>
        {(summary?.continueReading?.length ?? 0) === 0 ? (
          <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
            Open a digital copy from Catalog to pick up where you left off.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {summary?.continueReading.map((item) => (
              <Pressable
                key={item.digitalBookId}
                onPress={() =>
                  navigation.getParent()?.navigate("Catalog", {
                    screen: "DigitalBookDetail",
                    params: { digitalBookId: item.digitalBookId },
                  })
                }
                style={{
                  width: 160,
                  marginRight: 10,
                  padding: 12,
                  backgroundColor: colors.white,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                }}
              >
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.small,
                    color: colors.navy,
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontFamily: fontFamily.body,
                    fontSize: type.caption,
                    color: colors.muted,
                  }}
                >
                  {item.progress}% read
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Card>
    </Screen>
  );
}
