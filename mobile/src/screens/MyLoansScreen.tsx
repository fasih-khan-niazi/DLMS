import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  embedded?: boolean;
};

export default function MyLoansScreen({ navigation, embedded }: Props) {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const response = await api.get("/api/loans/mine");
      setLoans(response.data.loans || []);
    } catch {
      setLoans([]);
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

  const formatDate = (value: any) => {
    if (!value) return "-";
    const date = value._seconds
      ? new Date(value._seconds * 1000)
      : new Date(value);
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      {!embedded && (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      )}
      {!embedded && <Text style={styles.heading}>My Loans</Text>}
      {embedded && <Text style={styles.headingEmbedded}>Your loans</Text>}

      {loading ? (
        <ActivityIndicator color="#2E4A62" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(item) => item.loanId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No loans yet. Scan a book QR to borrow.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>Status: {item.status}</Text>
              <Text style={styles.meta}>Borrowed: {formatDate(item.borrowedAt)}</Text>
              <Text style={styles.meta}>Due: {formatDate(item.dueDate)}</Text>
              {item.fineAmount > 0 && (
                <Text style={styles.fine}>
                  Fine: Rs {item.fineAmount} {item.finePaid ? "(paid)" : "(unpaid)"}
                </Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7F4",
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  back: {
    color: "#E8A838",
    marginBottom: 12,
    fontSize: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2E4A62",
    marginBottom: 16,
  },
  headingEmbedded: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2E4A62",
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E4A62",
  },
  meta: {
    marginTop: 4,
    color: "#6B7280",
  },
  fine: {
    marginTop: 8,
    color: "#B45309",
    fontWeight: "700",
  },
  empty: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 40,
  },
});
