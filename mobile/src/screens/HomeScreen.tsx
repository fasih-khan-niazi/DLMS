import React, { useCallback, useMemo, useState } from "react";
import { Text, View, ScrollView } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../config/api";
import { firebaseAuth } from "../config/firebase";
import { useProfile } from "../context/ProfileContext";
import { SearchBar } from "../components/SearchBar";
import { Card, Screen, BookCover, PressableScale } from "../components/ui";
import { invalidateCatalogCache } from "../utils/catalogCache";
import { invalidateDigitalCache } from "../utils/digitalCache";
import { runSideEffect } from "../utils/apiError";
import { useTheme } from "../theme";
import {
  getDashboardCache,
  setDashboardCache,
  type DashboardSnapshot,
} from "../utils/dashboardCache";
import { dueCountdown } from "../utils/loanDates";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const KARACHI = "Asia/Karachi";

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

function hourInKarachi(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: KARACHI,
    hour: "numeric",
    hour12: false,
  }).format(now);
  return Number(hour);
}

function dateLineKarachi(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KARACHI,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

function timeLineKarachi(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KARACHI,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
}

function greetingInKarachi(now = new Date()): string {
  const hour = hourInKarachi(now);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen({ navigation }: Props) {
  const { colors, fontFamily, radius, space, type, mode } = useTheme();
  const { profile, refresh: refreshProfile, isStaff } = useProfile();
  const [unread, setUnread] = useState(0);
  const [quickSearch, setQuickSearch] = useState("");
  const [summary, setSummary] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (opts?: { skipCache?: boolean }) => {
    const cached = opts?.skipCache ? null : await getDashboardCache();
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
      const readyRows = reservations.filter((r: any) => r.status === "ready");
      const waitingRows = reservations.filter((r: any) => r.status === "waiting");

      const datedLoans = loans
        .map((loan: any) => ({ loan, due: toMs(loan.dueDate) }))
        .filter((row: { due: number }) => row.due > 0)
        .sort((a: { due: number }, b: { due: number }) => a.due - b.due);
      const nextLoan = datedLoans[0];
      const nextDue = nextLoan ? dueCountdown(nextLoan.loan.dueDate) : null;

      const continueReading = (shelfRes.data.items || [])
        .filter((item: any) => Number(item.progress) > 0 && Number(item.progress) < 100)
        .slice(0, 8)
        .map((item: any) => ({
          digitalBookId: item.digitalBookId,
          title: item.title,
          author: item.author,
          progress: Number(item.progress) || 0,
          lastPage: Number(item.lastPage) || 1,
          totalPages: Number(item.totalPages) || undefined,
          thumbnailUrl: item.thumbnailUrl,
        }));

      const snapshot: DashboardSnapshot = {
        activeLoans: loans.length,
        overdueLoans,
        readyReservations: readyRows.length,
        waitingReservations: waitingRows.length,
        outstandingFines: profile?.totalOutstandingFines ?? 0,
        nextDueLabel: nextDue?.label,
        nextDueOverdue: nextDue?.overdue,
        readyTitle: readyRows[0]?.title,
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
          waitingReservations: 0,
          outstandingFines: profile?.totalOutstandingFines ?? 0,
          continueReading: [],
          fetchedAt: Date.now(),
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.activeBorrowCount, profile?.totalOutstandingFines]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadDashboard();
    }, [loadDashboard])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    runSideEffect(() => {
      invalidateCatalogCache();
      invalidateDigitalCache();
    });
    void refreshProfile().catch(() => {});
    void loadDashboard({ skipCache: true });
  }, [loadDashboard, refreshProfile]);

  const displayName =
    profile?.displayName || firebaseAuth.currentUser?.displayName || "there";

  const clock = useMemo(() => {
    const now = new Date();
    return {
      greeting: greetingInKarachi(now),
      dateLine: dateLineKarachi(now),
      timeLine: timeLineKarachi(now),
    };
  }, [summary?.fetchedAt]);

  const openUnifiedSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    navigation.navigate("UnifiedSearch", { query: trimmed });
  };

  const goToScan = () => navigation.getParent()?.navigate("Scan");
  const goToCatalog = () => navigation.getParent()?.navigate("Catalog");
  const goToEbooks = () =>
    navigation.getParent()?.navigate("Catalog", {
      screen: "CatalogMain",
      params: { initialTab: "digitalCopies" },
    });
  const goToBookshelf = () =>
    navigation.getParent()?.navigate("Profile", { screen: "Bookshelf" });
  const goToActivity = (tab?: string) =>
    navigation.getParent()?.navigate("Activity", tab ? { initialTab: tab } : undefined);

  const tileBg = colors.white;
  const isDark = mode === "dark";

  return (
    <Screen
      scroll
      contentStyle={{ paddingHorizontal: 20 }}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: space.sm,
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
        <PressableScale
          onPress={() => navigation.navigate("Notifications")}
          hitSlop={8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: tileBg,
            borderWidth: 1,
            borderColor: unread > 0 ? colors.amber : colors.border,
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
                  color: isDark ? "#1A2834" : colors.navyDark,
                  fontSize: 10,
                  fontFamily: fontFamily.bodyBold,
                }}
              >
                {unread > 9 ? "9+" : unread}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>

      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: type.titleSm,
          color: colors.navy,
        }}
      >
        {clock.greeting}, {displayName}
      </Text>
      <Text
        style={{
          marginTop: 4,
          marginBottom: space.lg,
          fontFamily: fontFamily.body,
          fontSize: type.small,
          color: colors.muted,
        }}
      >
        {clock.dateLine} · {clock.timeLine} PKT
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

      <View style={{ gap: space.sm, marginBottom: space.md }}>
        {loading && !summary ? (
          <Card>
            <Text style={{ fontFamily: fontFamily.body, color: colors.muted, fontSize: type.small }}>
              Loading your library summary...
            </Text>
          </Card>
        ) : (
          <>
            <PressableScale onPress={() => goToActivity("loans")}>
              <Card>
                <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
                  {(summary?.activeLoans ?? 0) === 1
                    ? "1 active loan"
                    : `${summary?.activeLoans ?? 0} active loans`}
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.small,
                    color: summary?.nextDueOverdue ? colors.danger : colors.muted,
                  }}
                >
                  {summary?.nextDueLabel || "Nothing on loan. Scan a copy to borrow."}
                </Text>
              </Card>
            </PressableScale>

            {(summary?.overdueLoans ?? 0) > 0 || (summary?.outstandingFines ?? 0) > 0 ? (
              <PressableScale onPress={() => goToActivity("loans")}>
                <Card style={{ borderWidth: 1, borderColor: colors.danger }}>
                  <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.danger }}>
                    {(summary?.overdueLoans ?? 0) > 0
                      ? `${summary?.overdueLoans} overdue ${summary?.overdueLoans === 1 ? "loan" : "loans"}`
                      : "Unpaid fines"}
                  </Text>
                  <Text style={{ marginTop: 6, fontFamily: fontFamily.body, fontSize: type.small, color: colors.text }}>
                    {(summary?.outstandingFines ?? 0) > 0
                      ? `Outstanding fines: Rs ${summary?.outstandingFines}`
                      : "Return soon to avoid extra charges."}
                  </Text>
                </Card>
              </PressableScale>
            ) : null}

            {(summary?.readyReservations ?? 0) > 0 ? (
              <PressableScale onPress={() => goToActivity("reservations")}>
                <Card style={{ borderWidth: 1, borderColor: colors.amber }}>
                  <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
                    Ready for pickup
                  </Text>
                  <Text style={{ marginTop: 6, fontFamily: fontFamily.body, fontSize: type.small, color: colors.text }}>
                    {summary?.readyTitle
                      ? `"${summary.readyTitle}" is waiting at the desk.`
                      : `${summary?.readyReservations} reservation ready. Scan the copy to claim it.`}
                  </Text>
                </Card>
              </PressableScale>
            ) : null}

            {(summary?.waitingReservations ?? 0) > 0 ? (
              <PressableScale onPress={() => goToActivity("reservations")}>
                <Card>
                  <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
                    {(summary?.waitingReservations ?? 0) === 1
                      ? "1 title in the queue"
                      : `${summary?.waitingReservations} titles in the queue`}
                  </Text>
                  <Text style={{ marginTop: 6, fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
                    You will be notified when a copy is ready.
                  </Text>
                </Card>
              </PressableScale>
            ) : null}

            {unread > 0 ? (
              <PressableScale onPress={() => navigation.navigate("Notifications")}>
                <Card>
                  <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
                    {unread === 1 ? "1 unread notice" : `${unread} unread notices`}
                  </Text>
                  <Text style={{ marginTop: 6, fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
                    Due dates, holds, and library updates.
                  </Text>
                </Card>
              </PressableScale>
            ) : null}
          </>
        )}
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
          Quick actions
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            { label: "Scan QR", icon: "qr-code-outline" as const, onPress: goToScan },
            { label: "Catalog", icon: "library-outline" as const, onPress: goToCatalog },
            { label: "E-books", icon: "tablet-portrait-outline" as const, onPress: goToEbooks },
            { label: "Bookshelf", icon: "bookmarks-outline" as const, onPress: goToBookshelf },
            ...(isStaff
              ? [{ label: "Add book", icon: "add-circle-outline" as const, onPress: () => navigation.getParent()?.navigate("Profile", { screen: "AddBook" }) }]
              : []),
          ].map((action) => (
            <PressableScale
              key={action.label}
              onPress={action.onPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: tileBg,
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
            </PressableScale>
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
              <PressableScale
                key={item.digitalBookId}
                onPress={() =>
                  navigation.getParent()?.navigate("Catalog", {
                    screen: "PdfReader",
                    params: {
                      digitalBookId: item.digitalBookId,
                      title: item.title,
                      initialPage: item.lastPage || 1,
                      initialProgress: item.progress,
                      totalPages: item.totalPages,
                      onBookshelf: true,
                    },
                  })
                }
                style={{ width: 92, marginRight: 12 }}
              >
                <BookCover
                  uri={item.thumbnailUrl}
                  width={92}
                  height={138}
                  style={{ alignSelf: "center" }}
                />
                <Text
                  numberOfLines={2}
                  style={{
                    marginTop: 8,
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.caption,
                    color: colors.navy,
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: fontFamily.body,
                    fontSize: type.caption,
                    color: colors.muted,
                  }}
                >
                  {item.progress}%
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        )}
      </Card>
    </Screen>
  );
}
