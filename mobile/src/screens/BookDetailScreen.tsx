import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api, { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";
import { useProfile } from "../context/ProfileContext";
import { CopyQrModal } from "../components/CopyQrModal";
import { AppModal } from "../components/AppModal";
import { BookCover, Badge, Button, Card, BackButton, Input } from "../components/ui";
import { BookDetailSkeleton } from "../components/Skeleton";
import { formatIsbn } from "../utils/isbn";
import { invalidateCatalogCache } from "../utils/catalogCache";
import { invalidateCoverCache } from "../utils/coverImage";
import {
  getAllowInAppCopyBorrow,
  getLibrariansCanBorrow,
  invalidateAppConfigCache,
} from "../utils/appConfig";
import { extractApiError, runSideEffect } from "../utils/apiError";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ params: { isbn: string } }, "params">;
};

type QrModalState = {
  copyLabel: string;
  qrPayload: string;
  authors?: string[];
};

export default function BookDetailScreen({ navigation, route }: Props) {
  const { isbn } = route.params;
  const { isStaff, profile, refresh: refreshProfile } = useProfile();
  const { colors, fontFamily, space, type, radius } = useTheme();

  const [book, setBook] = useState<any>(null);
  const [myActiveCopyIds, setMyActiveCopyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [coverUrlDraft, setCoverUrlDraft] = useState("");
  const [coverRevision, setCoverRevision] = useState(0);
  const [savingCover, setSavingCover] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [qrModal, setQrModal] = useState<QrModalState | null>(null);
  const [expandedCopyId, setExpandedCopyId] = useState<string | null>(null);
  const [coverSuccess, setCoverSuccess] = useState<{ title: string; message: string } | null>(null);
  const [reserveFeedback, setReserveFeedback] = useState<{
    variant: "success" | "error" | "info";
    title: string;
    message: string;
    goActivity?: boolean;
  } | null>(null);
  const [allowInAppCopyBorrow, setAllowInAppCopyBorrow] = useState(false);
  const [librariansCanBorrow, setLibrariansCanBorrow] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthors, setEditAuthors] = useState("");
  const [editCategories, setEditCategories] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPageCount, setEditPageCount] = useState("");
  const [addCopiesQty, setAddCopiesQty] = useState("1");
  const [savingDetails, setSavingDetails] = useState(false);
  const [addingCopies, setAddingCopies] = useState(false);
  const [copyActionId, setCopyActionId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{
    variant: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [staffModal, setStaffModal] = useState<{
    variant: "success" | "error" | "info" | "danger";
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: "primary" | "dangerSoft";
    onConfirm?: () => void;
  } | null>(null);

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    try {
      const [bookRes, loansRes] = await Promise.all([
        api.get(`/api/catalog/books/${isbn}`),
        api.get("/api/loans/mine", { params: { status: "active" } }),
      ]);
      setBook(bookRes.data);
      setCoverUrlDraft(bookRes.data.thumbnailUrl || "");
      setCoverRevision((n) => n + 1);
      setEditTitle(bookRes.data.title || "");
      setEditAuthors((bookRes.data.authors || []).join(", "));
      setEditCategories((bookRes.data.categories || []).join(", "));
      setEditDescription(bookRes.data.description || "");
      setEditPageCount(
        bookRes.data.pageCount != null ? String(bookRes.data.pageCount) : ""
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
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void getAllowInAppCopyBorrow(true).then(setAllowInAppCopyBorrow);
      void getLibrariansCanBorrow(true).then(setLibrariansCanBorrow);
      void load();
    }, [isbn])
  );

  const applyCoverUpdate = (thumbnailUrl: string, coverImageSource = "manual") => {
    setBook((prev: any) =>
      prev ? { ...prev, thumbnailUrl, coverImageSource } : prev
    );
    setCoverUrlDraft(thumbnailUrl);
    setCoverRevision((n) => n + 1);
    invalidateCatalogCache();
    void invalidateCoverCache(isbn);
  };

  const canReserve =
    book && (book.availableCount || 0) === 0 && (book.totalCopies || 0) > 0;

  const hasMyLoan = (book?.copies || []).some(
    (copy: any) => copy.status === "issued" && myActiveCopyIds.has(copy.copyId)
  );

  const reserveBook = async () => {
    setReserving(true);

    let response: any;
    try {
      response = await api.post("/api/reservations", { isbn });
    } catch (error: any) {
      const apiMessage = extractApiError(error, "Request failed");
      const already =
        /already have an active reservation/i.test(apiMessage) ||
        /already have this book on loan/i.test(apiMessage);
      setReserving(false);
      setReserveFeedback({
        variant: already ? "info" : "error",
        title: already ? "Already reserved" : "Could not reserve",
        message: apiMessage,
      });
      return;
    }

    setReserving(false);
    setReserveFeedback({
      variant: "success",
      title: "Reservation placed",
      message:
        response.data?.message ||
        "You are in the queue. We will notify you when a copy is ready to claim.",
      goActivity: true,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    runSideEffect(invalidateCatalogCache);
    void load({ silent: true });
  };

  const goToScan = () => {
    navigation.getParent()?.navigate("Scan");
  };

  const runCopyAction = async (
    copyId: string,
    action: "borrow" | "return",
    copyLabel: string
  ) => {
    setCopyActionId(copyId);
    const endpoint = action === "borrow" ? "/api/loans/borrow" : "/api/loans/return";

    let response: any;
    try {
      response = await api.post(endpoint, { copyId });
    } catch (error: any) {
      setCopyActionId(null);
      setCopyFeedback({
        variant: "error",
        title: action === "borrow" ? "Could not borrow" : "Could not return",
        message: extractApiError(error, "Request failed"),
      });
      return;
    }

    // Server committed the change. Report success first, then reconcile the view.
    setCopyActionId(null);
    setCopyFeedback({
      variant: "success",
      title: action === "borrow" ? "Borrowed" : "Returned",
      message:
        response.data?.message ||
        `${copyLabel} ${action === "borrow" ? "is now on your account" : "was returned successfully"}.`,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    runSideEffect(invalidateCatalogCache);
    void refreshProfile().catch(() => {});
    void load({ silent: true });
  };

  const toggleCatalogActive = () => {
    if (!book) return;
    const reactivating = book.isActive === false;

    if (reactivating) {
      setStaffModal({
        variant: "info",
        title: "Reactivate title?",
        message: "Students will see this book in the catalog again.",
        confirmLabel: "Reactivate",
        onConfirm: () => void performStatusChange(true),
      });
      return;
    }

    const pending = Number(book.pendingReservationCount) || 0;
    const onLoan = Number(book.issuedCount) || 0;

    if (onLoan > 0) {
      setStaffModal({
        variant: "error",
        title: "Cannot deactivate",
        message: "A copy of this title is currently on loan. Wait until all copies are returned.",
      });
      return;
    }

    const reservationNote =
      pending > 0
        ? `${pending} student reservation${pending === 1 ? " is" : "s are"} waiting or ready for pickup. Deactivating will cancel ${pending === 1 ? "it" : "them"} and notify the student${pending === 1 ? "" : "s"}.`
        : "Students will no longer see this title in the catalog.";

    setStaffModal({
      variant: "danger",
      title: "Deactivate title?",
      message: reservationNote,
      confirmLabel: "Deactivate",
      confirmVariant: "dangerSoft",
      onConfirm: () => void performStatusChange(false),
    });
  };

  const performStatusChange = async (isActive: boolean) => {
    setTogglingStatus(true);

    let response: any;
    try {
      response = await api.patch(`/api/catalog/books/${encodeURIComponent(isbn)}/status`, {
        isActive,
      });
    } catch (error: any) {
      setTogglingStatus(false);
      setStaffModal({
        variant: "error",
        title: "Update failed",
        message: extractApiError(error, "Could not update book status"),
      });
      return;
    }

    setTogglingStatus(false);
    setStaffModal({
      variant: "success",
      title: isActive ? "Reactivated" : "Deactivated",
      message: response.data?.message || "Updated",
    });
    runSideEffect(invalidateCatalogCache);
    void load({ silent: true });
  };

  const saveCoverUrl = async () => {
    const url = coverUrlDraft.trim();
    if (!url) {
      setStaffModal({
        variant: "info",
        title: "Cover URL required",
        message: "Enter an image URL or upload a file.",
      });
      return;
    }

    setSavingCover(true);
    try {
      await api.patch(`/api/catalog/books/${encodeURIComponent(isbn)}/cover`, {
        thumbnailUrl: url,
      });
      applyCoverUpdate(url, "manual");
      setCoverSuccess({
        title: "Cover saved",
        message: "The book cover was updated. It should appear right away across the catalog.",
      });
    } catch (error: any) {
      setStaffModal({
        variant: "error",
        title: "Save failed",
        message: extractApiError(error, "Could not save cover URL"),
      });
    } finally {
      setSavingCover(false);
    }
  };

  const uploadCoverImage = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/webp"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingCover(true);
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.name || "cover.jpg",
        type: asset.mimeType || "image/jpeg",
      } as any);

      const response = await fetch(
        `${API_BASE_URL}/api/catalog/books/${encodeURIComponent(isbn)}/cover`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      applyCoverUpdate(data.thumbnailUrl, "manual");
      setCoverSuccess({
        title: "Cover uploaded",
        message: "Your image was saved and linked to this book. It should appear right away across the catalog.",
      });
    } catch (error: any) {
      setStaffModal({
        variant: "error",
        title: "Upload failed",
        message: error.message || "Could not upload cover",
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const saveBookDetails = async () => {
    if (!editTitle.trim()) {
      setStaffModal({
        variant: "info",
        title: "Title required",
        message: "Enter a title before saving.",
      });
      return;
    }
    setSavingDetails(true);
    try {
      const { data } = await api.patch(`/api/catalog/books/${encodeURIComponent(isbn)}`, {
        title: editTitle.trim(),
        authors: editAuthors,
        categories: editCategories,
        description: editDescription,
        pageCount: editPageCount.trim() ? Number(editPageCount) : undefined,
      });
      if (data?.book) setBook((prev: any) => ({ ...prev, ...data.book }));
      runSideEffect(invalidateCatalogCache);
      setStaffModal({
        variant: "success",
        title: "Details saved",
        message: "Title, authors and other fields were updated.",
      });
    } catch (error: any) {
      setStaffModal({
        variant: "error",
        title: "Could not save",
        message: extractApiError(error, "Failed to update book details"),
      });
    } finally {
      setSavingDetails(false);
    }
  };

  const addPhysicalCopies = async () => {
    const qty = Number(addCopiesQty);
    if (!Number.isInteger(qty) || qty < 1) {
      setStaffModal({
        variant: "info",
        title: "Check the copy count",
        message: "Number of new copies must be a whole number of 1 or more.",
      });
      return;
    }
    setAddingCopies(true);
    try {
      await api.post("/api/catalog/copies", { isbn, quantity: qty });
      runSideEffect(invalidateCatalogCache);
      await load({ silent: true });
      setStaffModal({
        variant: "success",
        title: "Copies added",
        message: `${qty} new ${qty === 1 ? "copy was" : "copies were"} added. Print labels from Available Copies.`,
      });
    } catch (error: any) {
      setStaffModal({
        variant: "error",
        title: "Could not add copies",
        message: extractApiError(error, "Failed to add copies"),
      });
    } finally {
      setAddingCopies(false);
    }
  };

  if (loading && !book) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <BookDetailSkeleton />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <Text style={{ fontFamily: fontFamily.bodyBold, color: colors.danger }}>Book not found</Text>
        <BackButton onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
      </View>
    );
  }

  const availabilityTone =
    book.availability === "Available"
      ? "success"
      : book.availability === "Reserved"
        ? "warning"
        : "muted";

  const staffMayBorrow = !isStaff || librariansCanBorrow;
  const showCirculation = book.isActive !== false && staffMayBorrow;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.cream }}
        contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              invalidateCatalogCache();
              invalidateAppConfigCache();
              void getAllowInAppCopyBorrow(true).then(setAllowInAppCopyBorrow);
              void getLibrariansCanBorrow(true).then(setLibrariansCanBorrow);
              void load({ silent: true });
            }}
            tintColor={colors.navy}
          />
        }
      >
        <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: space.sm, marginLeft: -8 }} />

        <View style={{ alignItems: "center", marginBottom: space.lg }}>
          <BookCover
            uri={book.thumbnailUrl}
            cacheKey={coverRevision}
            width={160}
            height={240}
          />
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
          label={book.isActive === false ? "Inactive" : book.availability || "Unavailable"}
          tone={book.isActive === false ? "danger" : availabilityTone}
          style={{ marginTop: space.sm }}
        />
        {book.isActive !== false ? (
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
        ) : null}
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

        {showCirculation ? (
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

        {isStaff && !librariansCanBorrow && book.isActive !== false ? (
          <Card style={{ marginBottom: space.md }}>
            <Text
              style={{
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
                lineHeight: 20,
              }}
            >
              Staff borrowing is off. Use Manage this book to edit details, or the Scan tab if you
              still have a copy to return.
            </Text>
          </Card>
        ) : null}

        {isStaff ? (
          <Card style={{ marginBottom: space.md }}>
            <Pressable
              onPress={() => setManageOpen((open) => !open)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.body,
                  color: colors.navy,
                }}
              >
                Manage this book
              </Text>
              <Ionicons
                name={manageOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.navy}
              />
            </Pressable>
            {manageOpen ? (
              <View style={{ marginTop: space.md }}>
                <Input label="Title" value={editTitle} onChangeText={setEditTitle} />
                <Input
                  label="Authors"
                  value={editAuthors}
                  onChangeText={setEditAuthors}
                  placeholder="Separate names with commas"
                />
                <Input
                  label="Categories"
                  value={editCategories}
                  onChangeText={setEditCategories}
                  placeholder="Fiction, Classics"
                />
                <Input
                  label="Page count"
                  value={editPageCount}
                  onChangeText={setEditPageCount}
                  keyboardType="number-pad"
                />
                <Input
                  label="Description"
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                />
                <Button
                  title="Save details"
                  onPress={() => void saveBookDetails()}
                  loading={savingDetails}
                  style={{ marginBottom: space.md }}
                />

                <Text
                  style={{
                    fontFamily: fontFamily.bodyBold,
                    fontSize: type.small,
                    color: colors.navy,
                    marginBottom: space.sm,
                  }}
                >
                  Cover
                </Text>
                <Text
                  style={{
                    fontFamily: fontFamily.body,
                    fontSize: type.caption,
                    color: colors.muted,
                    marginBottom: space.sm,
                  }}
                >
                  Source: {book.coverImageSource === "manual" ? "Manual" : "Google Books (auto)"}
                </Text>
                <Input
                  label="Cover image URL"
                  value={coverUrlDraft}
                  onChangeText={setCoverUrlDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="https://..."
                />
                <Button
                  title="Save cover URL"
                  variant="secondary"
                  onPress={saveCoverUrl}
                  loading={savingCover}
                  style={{ marginBottom: space.sm }}
                />
                <Button
                  title="Upload image file"
                  variant="amber"
                  onPress={uploadCoverImage}
                  loading={uploadingCover}
                  style={{ marginBottom: space.md }}
                />

                <Input
                  label="Add physical copies"
                  value={addCopiesQty}
                  onChangeText={setAddCopiesQty}
                  keyboardType="number-pad"
                />
                <Button
                  title="Add copies"
                  variant="secondary"
                  onPress={() => void addPhysicalCopies()}
                  loading={addingCopies}
                  style={{ marginBottom: space.md }}
                />

                <Button
                  title={book.isActive === false ? "Reactivate title" : "Deactivate title"}
                  variant={book.isActive === false ? "successSoft" : "dangerSoft"}
                  onPress={toggleCatalogActive}
                  loading={togglingStatus}
                />
              </View>
            ) : null}
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

        <>
          <Text
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: type.titleSm,
              color: colors.navy,
              marginBottom: space.sm,
            }}
          >
            Available Copies
          </Text>
          <Text
            style={{
              fontFamily: fontFamily.body,
              fontSize: type.small,
              color: colors.muted,
              marginBottom: space.md,
              lineHeight: 20,
            }}
          >
            {isStaff
              ? allowInAppCopyBorrow
                ? "Each copy has a unique QR for shelf labels. Borrow or return from here when enabled, or use the Scan tab."
                : "Each copy has a unique QR for shelf labels. Borrow and return via the Scan tab. Open a copy to view or export its label."
              : allowInAppCopyBorrow
                ? "Borrow or return copies below when available, or use the Scan tab."
                : "Borrow and return only via the Scan tab. Status for each copy is shown below."}
          </Text>
          {(book.copies || []).length === 0 ? (
            <Text style={{ fontFamily: fontFamily.body, color: colors.muted, marginBottom: space.lg }}>
              No physical copies yet.
            </Text>
          ) : (
            (book.copies || []).map((copy: any, index: number) => {
              const copyLabel = `Copy ${index + 1}`;
              const expanded = expandedCopyId === copy.copyId;
              const isMine = myActiveCopyIds.has(copy.copyId);
              const heldForMe =
                copy.status === "reserved" &&
                !!profile?.uid &&
                String(copy.reservedForUserId || "") === profile.uid;
              const showBorrow =
                allowInAppCopyBorrow &&
                staffMayBorrow &&
                (copy.status === "available" || heldForMe);
              const showReturn =
                allowInAppCopyBorrow && staffMayBorrow && copy.status === "issued" && isMine;
              const busy = copyActionId === copy.copyId;

              const statusBlock = (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fontFamily.bodyBold, color: colors.navy }}>
                    {copyLabel}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: fontFamily.body,
                      fontSize: type.small,
                      color: colors.muted,
                      textTransform: "capitalize",
                    }}
                  >
                    Status: {copy.status}
                  </Text>
                </View>
              );

              return (
                <Card key={copy.copyId} style={{ marginBottom: space.sm }}>
                  {isStaff ? (
                    <Pressable
                      onPress={() =>
                        setExpandedCopyId((current) =>
                          current === copy.copyId ? null : copy.copyId
                        )
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      {statusBlock}
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={colors.navy}
                      />
                    </Pressable>
                  ) : (
                    statusBlock
                  )}

                  {showBorrow || showReturn ? (
                    <View style={{ marginTop: space.sm }}>
                      {showBorrow ? (
                        <Button
                          title={heldForMe ? "Borrow reserved copy" : "Borrow copy"}
                          onPress={() => void runCopyAction(copy.copyId, "borrow", copyLabel)}
                          loading={busy}
                        />
                      ) : null}
                      {showReturn ? (
                        <Button
                          title="Return copy"
                          variant="secondary"
                          onPress={() => void runCopyAction(copy.copyId, "return", copyLabel)}
                          loading={busy}
                          style={{ marginTop: showBorrow ? space.sm : 0 }}
                        />
                      ) : null}
                    </View>
                  ) : null}

                  {expanded && isStaff && !!copy.qrPayload ? (
                    <View style={{ marginTop: space.sm }}>
                      <Button
                        title="View QR label"
                        variant="secondary"
                        onPress={() =>
                          setQrModal({
                            copyLabel,
                            qrPayload: copy.qrPayload,
                            authors: book.authors,
                          })
                        }
                      />
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}
        </>
      </ScrollView>

      {qrModal ? (
        <CopyQrModal
          visible
          onClose={() => setQrModal(null)}
          title={book.title}
          authors={book.authors}
          isbn={formatIsbn(book.isbn)}
          copyLabel={qrModal.copyLabel}
          qrPayload={qrModal.qrPayload}
        />
      ) : null}

      <AppModal
        visible={!!coverSuccess}
        variant="success"
        title={coverSuccess?.title || ""}
        message={coverSuccess?.message || ""}
        confirmLabel="Done"
        onClose={() => setCoverSuccess(null)}
      />

      <AppModal
        visible={!!copyFeedback}
        variant={copyFeedback?.variant === "success" ? "success" : "error"}
        title={copyFeedback?.title || ""}
        message={copyFeedback?.message || ""}
        confirmLabel="OK"
        onClose={() => setCopyFeedback(null)}
      />

      <AppModal
        visible={!!staffModal}
        variant={staffModal?.variant || "info"}
        title={staffModal?.title || ""}
        message={staffModal?.message || ""}
        confirmLabel={staffModal?.confirmLabel || "OK"}
        confirmVariant={staffModal?.confirmVariant || "primary"}
        cancelLabel={staffModal?.onConfirm ? "Keep as is" : undefined}
        onClose={() => setStaffModal(null)}
        onConfirm={
          staffModal?.onConfirm
            ? () => {
                const next = staffModal.onConfirm;
                setStaffModal(null);
                next?.();
              }
            : () => setStaffModal(null)
        }
        onCancel={staffModal?.onConfirm ? () => setStaffModal(null) : undefined}
      />

      <AppModal
        visible={!!reserveFeedback}
        variant={reserveFeedback?.variant || "info"}
        title={reserveFeedback?.title || ""}
        message={reserveFeedback?.message || ""}
        confirmLabel={reserveFeedback?.goActivity ? "View reservations" : "OK"}
        cancelLabel={reserveFeedback?.goActivity ? "Stay here" : undefined}
        onClose={() => setReserveFeedback(null)}
        onConfirm={() => {
          const go = !!reserveFeedback?.goActivity;
          setReserveFeedback(null);
          if (go) {
            navigation.getParent()?.navigate("Activity", { initialTab: "reservations" });
          }
        }}
        onCancel={
          reserveFeedback?.goActivity
            ? () => setReserveFeedback(null)
            : undefined
        }
      />
    </>
  );
}
