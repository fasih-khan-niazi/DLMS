import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import api from "../config/api";
import { useProfile } from "../context/ProfileContext";
import { BookCover, Badge, Button, Card } from "../components/ui";
import { formatIsbn } from "../utils/isbn";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ params: { isbn: string } }, "params">;
};

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`;
}

export default function BookDetailScreen({ navigation, route }: Props) {
  const { isbn } = route.params;
  const { isStaff } = useProfile();
  const { colors, fontFamily, space, type, radius } = useTheme();

  const [book, setBook] = useState<any>(null);
  const [myActiveCopyIds, setMyActiveCopyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [actionCopyId, setActionCopyId] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const load = async () => {
    try {
      const [bookRes, loansRes] = await Promise.all([
        api.get(`/api/catalog/books/${isbn}`),
        api.get("/api/loans/mine", { params: { status: "active" } }),
      ]);
      setBook(bookRes.data);

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

  const hasMyLoan = (book?.copies || []).some(
    (copy: any) => copy.status === "issued" && myActiveCopyIds.has(copy.copyId)
  );

  const reserveBook = async () => {
    setReserving(true);
    try {
      const response = await api.post("/api/reservations", { isbn });
      Alert.alert("Reserved", response.data.message || "Added to queue");
      navigation.getParent()?.navigate("Activity");
    } catch (error: any) {
      Alert.alert("Could not reserve", error.response?.data?.error || "Request failed");
    } finally {
      setReserving(false);
    }
  };

  const goToScan = () => {
    navigation.getParent()?.navigate("Scan");
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <Text style={{ fontFamily: fontFamily.bodyBold, color: colors.danger }}>Book not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const availabilityTone =
    book.availability === "Available"
      ? "success"
      : book.availability === "Reserved"
        ? "warning"
        : "muted";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40 }}
    >
      <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: space.md }}>
        <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>← Back</Text>
      </Pressable>

      <View style={{ alignItems: "center", marginBottom: space.lg }}>
        <BookCover uri={book.thumbnailUrl} width={160} height={240} />
        <Text
          style={{
            marginTop: space.md,
            textAlign: "center",
            fontFamily: fontFamily.display,
            fontSize: type.titleSm,
            color: colors.navy,
          }}
        >
          {book.title}
        </Text>
        <Text
          style={{
            marginTop: 6,
            textAlign: "center",
            fontFamily: fontFamily.body,
            fontSize: type.body,
            color: colors.muted,
          }}
        >
          {(book.authors || []).join(", ") || "Unknown author"}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontFamily: fontFamily.body,
            fontSize: type.small,
            color: colors.muted,
          }}
        >
          ISBN {formatIsbn(book.isbn)}
        </Text>
        <Badge
          label={book.availability || "Unavailable"}
          tone={availabilityTone}
          style={{ marginTop: space.sm }}
        />
        <Text
          style={{
            marginTop: space.sm,
            fontFamily: fontFamily.body,
            fontSize: type.small,
            color: colors.text,
          }}
        >
          {book.availableCount || 0} available · {book.totalCopies || 0} total copies
        </Text>
        {book.isActive === false ? (
          <Text
            style={{
              marginTop: space.sm,
              color: colors.danger,
              fontFamily: fontFamily.bodySemiBold,
              fontSize: type.small,
            }}
          >
            Inactive · hidden from students
          </Text>
        ) : null}
      </View>

      {!isStaff && book.isActive !== false ? (
        <Card style={{ marginBottom: space.md }}>
          {(book.availableCount || 0) > 0 ? (
            <Button title="Scan to borrow" onPress={goToScan} />
          ) : null}
          {canReserve ? (
            <Button
              title="Reserve this title"
              variant="secondary"
              onPress={reserveBook}
              loading={reserving}
              style={{ marginTop: (book.availableCount || 0) > 0 ? space.sm : 0 }}
            />
          ) : null}
          {hasMyLoan ? (
            <Text
              style={{
                marginTop: space.sm,
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
                lineHeight: 20,
              }}
            >
              You have this title on loan. Use the Scan tab to return it.
            </Text>
          ) : null}
          {!canReserve && (book.availableCount || 0) === 0 && !hasMyLoan ? (
            <Text
              style={{
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
                lineHeight: 20,
              }}
            >
              No copies available right now. Reserve when all copies are checked out.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {isStaff ? (
        <Card style={{ marginBottom: space.md }}>
          <Button
            title={book.isActive === false ? "Reactivate title" : "Deactivate title"}
            variant="secondary"
            onPress={toggleCatalogActive}
            loading={togglingStatus}
          />
        </Card>
      ) : null}

      {!!book.description && (
        <Card style={{ marginBottom: space.md }}>
          <Text
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: type.body,
              color: colors.navy,
              marginBottom: space.sm,
            }}
          >
            Description
          </Text>
          <Text
            style={{
              fontFamily: fontFamily.body,
              fontSize: type.small,
              color: colors.text,
              lineHeight: 22,
            }}
          >
            {book.description}
          </Text>
        </Card>
      )}

      {(book.categories || []).length > 0 ? (
        <Card style={{ marginBottom: space.md }}>
          <Text
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: type.body,
              color: colors.navy,
              marginBottom: space.sm,
            }}
          >
            Categories
          </Text>
          <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.text }}>
            {(book.categories || []).join(" · ")}
          </Text>
        </Card>
      ) : null}

      {isStaff ? (
        <>
          <Text
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: type.titleSm,
              color: colors.navy,
              marginBottom: space.sm,
            }}
          >
            Manage copies
          </Text>
          {(book.copies || []).length === 0 ? (
            <Text style={{ fontFamily: fontFamily.body, color: colors.muted, marginBottom: space.lg }}>
              No physical copies yet.
            </Text>
          ) : (
            (book.copies || []).map((copy: any, index: number) => {
              const isMine = myActiveCopyIds.has(copy.copyId);
              const copyLabel = `Copy ${index + 1}`;

              return (
                <Card key={copy.copyId} style={{ marginBottom: space.sm }}>
                  <Text style={{ fontFamily: fontFamily.bodyBold, color: colors.navy }}>{copyLabel}</Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: fontFamily.body,
                      fontSize: type.small,
                      color: colors.muted,
                    }}
                  >
                    Status: {copy.status}
                  </Text>

                  {!!copy.qrPayload && (
                    <View style={{ marginTop: space.sm, alignItems: "center" }}>
                      <Image
                        source={{ uri: qrImageUrl(copy.qrPayload) }}
                        style={{ width: 140, height: 140, backgroundColor: colors.white, borderRadius: radius.sm }}
                      />
                    </View>
                  )}

                  {copy.status === "available" && book.isActive !== false && (
                    <Button
                      title="Borrow this copy"
                      onPress={() => borrowCopy(copy.copyId)}
                      loading={actionCopyId === copy.copyId}
                      style={{ marginTop: space.sm }}
                    />
                  )}

                  {copy.status === "issued" && isMine && (
                    <Button
                      title="Return this copy"
                      variant="secondary"
                      onPress={() => returnCopy(copy.copyId)}
                      loading={actionCopyId === copy.copyId}
                      style={{ marginTop: space.sm }}
                    />
                  )}

                  {copy.status === "reserved" && (
                    <Button
                      title="Claim reserved copy"
                      onPress={() => borrowCopy(copy.copyId)}
                      loading={actionCopyId === copy.copyId}
                      style={{ marginTop: space.sm }}
                    />
                  )}
                </Card>
              );
            })
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
