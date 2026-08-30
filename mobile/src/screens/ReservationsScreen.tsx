import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { AppModal } from "../components/AppModal";
import { Badge, Button, Card } from "../components/ui";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { SkeletonList } from "../components/Skeleton";
import { formatShortDate, reservationStatusChip } from "../utils/loanDates";
import { goToCatalogTab } from "../utils/navigation";
import { invalidateCatalogCache } from "../utils/catalogCache";
import { extractApiError, runSideEffect } from "../utils/apiError";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  embedded?: boolean;
};

export default function ReservationsScreen({ navigation, embedded }: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const load = async () => {
    setError(false);
    try {
      const response = await api.get("/api/reservations/mine");
      setItems(response.data.reservations || []);
    } catch {
      setItems([]);
      setError(true);
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

  const confirmCancel = async () => {
    if (!cancelId) return;
    setCancelling(true);

    try {
      await api.delete(`/api/reservations/${cancelId}`);
    } catch (err: any) {
      setCancelling(false);
      setCancelId(null);
      setFeedback({
        variant: "error",
        title: "Could not cancel",
        message: extractApiError(err, "Cancel failed. Try again."),
      });
      return;
    }

    // Server committed the cancel. Report success, then reconcile the views.
    setCancelling(false);
    setCancelId(null);
    setFeedback({
      variant: "success",
      title: "Reservation cancelled",
      message: "You left the waiting queue for this title.",
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Cancelling can free a held copy, so catalog availability may change.
    runSideEffect(invalidateCatalogCache);
    void load();
  };

  const goCatalog = () => goToCatalogTab(navigation);
  const goScan = () => navigation.navigate("Scan");

  return (
    <View style={[styles.container, { backgroundColor: colors.cream }]}>
      {!embedded && (
        <Text style={[styles.heading, { color: colors.navy, fontFamily: fontFamily.display }]}>
          My Reservations
        </Text>
      )}

      <Text
        style={{
          fontFamily: fontFamily.body,
          fontSize: type.small,
          color: colors.muted,
          marginBottom: space.md,
          lineHeight: 20,
        }}
      >
        When status is Ready, scan that copy&apos;s QR (Borrow mode) within the hold window.
      </Text>

      {loading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState onRetry={() => { setLoading(true); void load(); }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.reservationId}
          contentContainerStyle={{ paddingBottom: space.lg, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.navy}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No reservations"
              message="Reserve a book from its detail page when all copies are checked out."
              actionLabel="Browse catalog"
              onAction={goCatalog}
            />
          }
          renderItem={({ item }) => {
            const chip = reservationStatusChip(item.status);

            return (
              <Card style={{ marginBottom: space.sm }}>
                <View style={styles.row}>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.body,
                      color: colors.navy,
                    }}
                  >
                    {item.title || item.isbn}
                  </Text>
                  <Badge label={chip.label} tone={chip.tone} />
                </View>

                {item.status === "waiting" && (
                  <Text
                    style={{
                      marginTop: space.xs,
                      fontFamily: fontFamily.body,
                      fontSize: type.small,
                      color: colors.muted,
                    }}
                  >
                    Queue position: ~{item.queuePosition || "?"}
                  </Text>
                )}

                {item.status === "ready" && (
                  <>
                    <Text
                      style={{
                        marginTop: space.sm,
                        fontFamily: fontFamily.bodySemiBold,
                        fontSize: type.small,
                        color: colors.success,
                      }}
                    >
                      Ready for pickup
                    </Text>
                    <Text
                      style={{
                        marginTop: 4,
                        fontFamily: fontFamily.body,
                        fontSize: type.small,
                        color: colors.muted,
                      }}
                    >
                      Hold until {formatShortDate(item.expiresAt)}
                    </Text>
                    <Button title="Open scanner" onPress={goScan} style={{ marginTop: space.sm }} />
                  </>
                )}

                <Text
                  style={{
                    marginTop: space.sm,
                    fontFamily: fontFamily.body,
                    fontSize: type.caption,
                    color: colors.muted,
                  }}
                >
                  Created {formatShortDate(item.createdAt)}
                </Text>

                {item.status === "waiting" && (
                  <Button
                    title="Cancel reservation"
                    variant="dangerSoft"
                    onPress={() => setCancelId(item.reservationId)}
                    style={{ marginTop: space.md }}
                  />
                )}
              </Card>
            );
          }}
        />
      )}

      <AppModal
        visible={!!cancelId}
        variant="danger"
        presentation="sheet"
        title="Cancel reservation?"
        message="You will leave the waiting queue for this title. You can reserve again later if it is still unavailable."
        confirmLabel="Yes, cancel"
        confirmVariant="dangerSoft"
        cancelLabel="Keep reservation"
        onClose={() => setCancelId(null)}
        onConfirm={() => {
          if (!cancelling) void confirmCancel();
        }}
        onCancel={() => setCancelId(null)}
      />

      <AppModal
        visible={!!feedback}
        variant={feedback?.variant || "info"}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        confirmLabel="OK"
        onClose={() => setFeedback(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 28,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
});
