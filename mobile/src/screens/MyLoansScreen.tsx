import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { Badge, Card } from "../components/ui";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { SkeletonList } from "../components/Skeleton";
import {
  dueCountdown,
  formatShortDate,
  loanStatusChip,
} from "../utils/loanDates";
import { goToCatalogTab } from "../utils/navigation";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  embedded?: boolean;
};

export default function MyLoansScreen({ navigation, embedded }: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      const response = await api.get("/api/loans/mine", { params: { status: "active" } });
      setLoans(response.data.loans || []);
    } catch {
      setLoans([]);
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

  const goCatalog = () => goToCatalogTab(navigation);
  const goScan = () => navigation.navigate("Scan");

  return (
    <View style={[styles.container, { backgroundColor: colors.cream }]}>
      {!embedded && (
        <Text style={[styles.heading, { color: colors.navy, fontFamily: fontFamily.display }]}>
          My Loans
        </Text>
      )}

      {loading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState onRetry={() => { setLoading(true); void load(); }} />
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(item) => item.loanId}
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
              title="No active loans"
              message="Browse the catalog or scan a book QR to borrow."
              actionLabel="Browse catalog"
              onAction={goCatalog}
            />
          }
          renderItem={({ item }) => {
            const status = loanStatusChip(item.status, item.dueDate);
            const due = dueCountdown(item.dueDate);

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
                    {item.title}
                  </Text>
                  <Badge label={status.label} tone={status.tone} />
                </View>
                <Text
                  style={{
                    marginTop: space.xs,
                    fontFamily: fontFamily.body,
                    fontSize: type.small,
                    color: colors.muted,
                  }}
                >
                  Borrowed {formatShortDate(item.borrowedAt)}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.small,
                    color: due.overdue ? colors.danger : colors.text,
                  }}
                >
                  {due.label}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontFamily: fontFamily.body,
                    fontSize: type.caption,
                    color: colors.muted,
                  }}
                >
                  Due {formatShortDate(item.dueDate)}
                </Text>
                {item.fineAmount > 0 && (
                  <Text
                    style={{
                      marginTop: space.sm,
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.small,
                      color: colors.warning,
                    }}
                  >
                    Fine: Rs {item.fineAmount} {item.finePaid ? "(paid)" : "(unpaid)"}
                  </Text>
                )}
              </Card>
            );
          }}
        />
      )}

      {!loading && !error && loans.length > 0 ? (
        <Text
          style={{
            textAlign: "center",
            fontFamily: fontFamily.body,
            fontSize: type.caption,
            color: colors.muted,
            marginBottom: space.sm,
          }}
          onPress={goScan}
        >
          Tap Scan tab to return a book
        </Text>
      ) : null}
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
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
});
