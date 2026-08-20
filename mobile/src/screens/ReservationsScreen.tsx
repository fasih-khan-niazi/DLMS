import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function ReservationsScreen({ navigation }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const response = await api.get("/api/reservations/mine");
      setItems(response.data.reservations || []);
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

  const formatDate = (value: any) => {
    if (!value) return "-";
    const date = value._seconds
      ? new Date(value._seconds * 1000)
      : new Date(value);
    return date.toLocaleString();
  };

  const cancelReservation = (reservationId: string) => {
    Alert.alert("Cancel reservation?", "You will leave the waiting queue.", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/reservations/${reservationId}`);
            load();
          } catch (error: any) {
            Alert.alert("Error", error.response?.data?.error || "Cancel failed");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>My Reservations</Text>
      <Text style={styles.hint}>
        When status is Ready, scan that copy&apos;s QR (Borrow mode) within 72 hours.
      </Text>

      {loading ? (
        <ActivityIndicator color="#2E4A62" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.reservationId}
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
            <Text style={styles.empty}>No reservations yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title || item.isbn}</Text>
              <Text style={styles.meta}>ISBN: {item.isbn}</Text>
              <Text style={styles.status}>Status: {item.status}</Text>
              {item.status === "waiting" && (
                <Text style={styles.meta}>Queue position: ~{item.queuePosition || "?"}</Text>
              )}
              {item.status === "ready" && (
                <>
                  <Text style={styles.ready}>Ready for pickup</Text>
                  <Text style={styles.meta}>Copy: {item.assignedCopyId}</Text>
                  <Text style={styles.meta}>Hold until: {formatDate(item.expiresAt)}</Text>
                  <TouchableOpacity
                    style={styles.scanButton}
                    onPress={() => navigation.navigate("Scan")}
                  >
                    <Text style={styles.scanButtonText}>Open Scanner</Text>
                  </TouchableOpacity>
                </>
              )}
              <Text style={styles.meta}>Created: {formatDate(item.createdAt)}</Text>
              {item.status === "waiting" && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => cancelReservation(item.reservationId)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
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
    paddingTop: 56,
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
  },
  hint: {
    marginTop: 8,
    marginBottom: 16,
    color: "#6B7280",
    fontSize: 13,
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
  status: {
    marginTop: 8,
    color: "#4B5563",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  ready: {
    marginTop: 8,
    color: "#6BA3A8",
    fontWeight: "700",
  },
  scanButton: {
    marginTop: 12,
    backgroundColor: "#2E4A62",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  scanButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  cancelButton: {
    marginTop: 12,
    alignSelf: "flex-start",
  },
  cancelText: {
    color: "#B91C1C",
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 40,
  },
});
