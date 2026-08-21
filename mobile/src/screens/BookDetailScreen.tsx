import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import api from "../config/api";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ params: { isbn: string } }, "params">;
};

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`;
}

export default function BookDetailScreen({ navigation, route }: Props) {
  const { isbn } = route.params;
  const [book, setBook] = useState<any>(null);
  const [myActiveCopyIds, setMyActiveCopyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [actionCopyId, setActionCopyId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const load = async () => {
    try {
      const [bookRes, loansRes, meRes] = await Promise.all([
        api.get(`/api/catalog/books/${isbn}`),
        api.get("/api/loans/mine", { params: { status: "active" } }),
        api.get("/api/auth/me").catch(() => null),
      ]);
      setBook(bookRes.data);
      setIsStaff(
        meRes?.data?.role === "librarian" || meRes?.data?.role === "admin"
      );

      const mine = new Set<string>();
      (loansRes.data.loans || []).forEach((loan: any) => {
        if (loan.copyId) mine.add(loan.copyId);
      });
      setMyActiveCopyIds(mine);
    } catch {
      setBook(null);
      setMyActiveCopyIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [isbn])
  );

  const canReserve =
    book && (book.availableCount || 0) === 0 && (book.totalCopies || 0) > 0;

  const reserveBook = async () => {
    setReserving(true);
    try {
      const response = await api.post("/api/reservations", { isbn });
      Alert.alert("Reserved", response.data.message || "Added to queue");
      navigation.navigate("Activity");
    } catch (error: any) {
      Alert.alert("Could not reserve", error.response?.data?.error || "Request failed");
    } finally {
      setReserving(false);
    }
  };

  const borrowCopy = async (copyId: string) => {
    setActionCopyId(copyId);
    try {
      const response = await api.post("/api/loans/borrow", { copyId });
      Alert.alert("Borrowed", response.data.message || "Success");
      await load();
    } catch (error: any) {
      Alert.alert("Borrow failed", error.response?.data?.error || "Request failed");
    } finally {
      setActionCopyId(null);
    }
  };

  const returnCopy = async (copyId: string) => {
    setActionCopyId(copyId);
    try {
      const response = await api.post("/api/loans/return", { copyId });
      Alert.alert("Returned", response.data.message || "Success");
      await load();
    } catch (error: any) {
      Alert.alert("Return failed", error.response?.data?.error || "Request failed");
    } finally {
      setActionCopyId(null);
    }
  };

  const toggleCatalogActive = () => {
    if (!book) return;
    const next = book.isActive === false;
    const label = next ? "Reactivate" : "Deactivate";
    Alert.alert(
      `${label} title?`,
      next
        ? "Students will see this book in the catalog again."
        : "Students will not see this book. Loan and reservation history is kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: label,
          style: next ? "default" : "destructive",
          onPress: async () => {
            setTogglingStatus(true);
            try {
              await api.patch(`/api/catalog/books/${encodeURIComponent(isbn)}/status`, {
                isActive: next,
              });
              await load();
            } catch (error: any) {
              Alert.alert(
                "Update failed",
                error.response?.data?.error || "Could not update book status"
              );
            } finally {
              setTogglingStatus(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2E4A62" />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Book not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{book.title}</Text>
      <Text style={styles.meta}>{(book.authors || []).join(", ") || "Unknown author"}</Text>
      <Text style={styles.meta}>ISBN: {book.isbn}</Text>
      <Text style={styles.availability}>{book.availability}</Text>
      {book.isActive === false ? (
        <Text style={styles.inactiveBanner}>Inactive · hidden from students</Text>
      ) : null}
      <Text style={styles.counts}>
        {book.availableCount || 0} available · {book.issuedCount || 0} issued ·{" "}
        {book.reservedCount || 0} reserved · {book.totalCopies || 0} total
      </Text>

      {isStaff ? (
        <TouchableOpacity
          style={styles.staffStatusButton}
          onPress={toggleCatalogActive}
          disabled={togglingStatus}
        >
          {togglingStatus ? (
            <ActivityIndicator color="#2E4A62" />
          ) : (
            <Text style={styles.staffStatusText}>
              {book.isActive === false ? "Reactivate title" : "Deactivate title"}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {canReserve && book.isActive !== false ? (
        <TouchableOpacity
          style={styles.reserveButton}
          onPress={reserveBook}
          disabled={reserving}
        >
          {reserving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.reserveButtonText}>Reserve this book</Text>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.tip}>
          Reserve appears when no copies are available. If you already borrowed this
          title, you cannot reserve it.
        </Text>
      )}

      {!!book.description && (
        <>
          <Text style={styles.section}>Description</Text>
          <Text style={styles.description}>{book.description}</Text>
        </>
      )}

      <Text style={styles.section}>Physical Copies</Text>
      {(book.copies || []).length === 0 ? (
        <Text style={styles.meta}>No physical copies yet.</Text>
      ) : (
        (book.copies || []).map((copy: any) => {
          const isMine = myActiveCopyIds.has(copy.copyId);

          return (
            <View key={copy.copyId} style={styles.copyCard}>
              <Text style={styles.copyId}>{copy.copyId}</Text>
              <Text style={styles.meta}>Status: {copy.status}</Text>

              {!!copy.qrPayload && (
                <View style={styles.qrWrap}>
                  <Image
                    source={{ uri: qrImageUrl(copy.qrPayload) }}
                    style={styles.qrImage}
                  />
                  <Text style={styles.qrText}>{copy.qrPayload}</Text>
                </View>
              )}

              {copy.status === "available" && book.isActive !== false && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => borrowCopy(copy.copyId)}
                  disabled={actionCopyId === copy.copyId}
                >
                  {actionCopyId === copy.copyId ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Borrow this copy</Text>
                  )}
                </TouchableOpacity>
              )}

              {copy.status === "issued" && isMine && (
                <TouchableOpacity
                  style={styles.returnButton}
                  onPress={() => returnCopy(copy.copyId)}
                  disabled={actionCopyId === copy.copyId}
                >
                  {actionCopyId === copy.copyId ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Return this copy</Text>
                  )}
                </TouchableOpacity>
              )}

              {copy.status === "issued" && !isMine && (
                <Text style={styles.tip}>Issued to another student</Text>
              )}

              {copy.status === "reserved" && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => borrowCopy(copy.copyId)}
                  disabled={actionCopyId === copy.copyId}
                >
                  {actionCopyId === copy.copyId ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Claim reserved copy</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7F4",
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F7F4",
  },
  back: {
    color: "#E8A838",
    marginBottom: 16,
    fontSize: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#2E4A62",
  },
  meta: {
    marginTop: 6,
    color: "#6B7280",
  },
  availability: {
    marginTop: 12,
    color: "#6BA3A8",
    fontWeight: "700",
    fontSize: 16,
  },
  counts: {
    marginTop: 6,
    color: "#4B5563",
  },
  inactiveBanner: {
    marginTop: 8,
    color: "#B91C1C",
    fontWeight: "700",
  },
  staffStatusButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  staffStatusText: {
    color: "#2E4A62",
    fontWeight: "700",
  },
  reserveButton: {
    marginTop: 16,
    backgroundColor: "#E8A838",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  reserveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  tip: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#2E4A62",
  },
  description: {
    color: "#4B5563",
    lineHeight: 22,
  },
  copyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  copyId: {
    fontWeight: "700",
    color: "#2E4A62",
  },
  qrWrap: {
    marginTop: 12,
    alignItems: "center",
    gap: 8,
  },
  qrImage: {
    width: 180,
    height: 180,
    backgroundColor: "#fff",
  },
  qrText: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: "#2E4A62",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  returnButton: {
    marginTop: 12,
    backgroundColor: "#6BA3A8",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  error: {
    color: "#B91C1C",
    marginBottom: 12,
  },
  link: {
    color: "#E8A838",
  },
});
