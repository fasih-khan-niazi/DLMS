import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "../utils/haptics";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import api from "../config/api";
import { AppModal } from "../components/AppModal";
import { BookReviewSection, type ReviewItem, type ReviewSummary } from "../components/BookReviewSection";
import { BookCover, Button, Card, BackButton, Input, PressableScale } from "../components/ui";
import { BookDetailSkeleton } from "../components/Skeleton";
import { invalidateDigitalCache } from "../utils/digitalCache";
import { extractApiError, runSideEffect } from "../utils/apiError";
import { useProfile } from "../context/ProfileContext";
import { useTheme } from "../theme";

const safeInvalidateDigitalCache = () => runSideEffect(invalidateDigitalCache);

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ params: { digitalBookId: string } }, "params">;
};

export default function DigitalBookDetailScreen({ navigation, route }: Props) {
  const { digitalBookId } = route.params;
  const { isStaff } = useProfile();
  const { colors, fontFamily, space, type, radius } = useTheme();

  const [book, setBook] = useState<any>(null);
  const [shelf, setShelf] = useState<any>(null);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [draftRating, setDraftRating] = useState<number | null>(null);
  const [draftRecommend, setDraftRecommend] = useState<number | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewLocked, setReviewLocked] = useState(false);
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [reviewSuccessOpen, setReviewSuccessOpen] = useState(false);
  const [addedModalOpen, setAddedModalOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [modal, setModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: "",
  });
  const [manageOpen, setManageOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [bookRes, shelfRes, reviewsRes] = await Promise.all([
        api.get(`/api/digital-books/${digitalBookId}`),
        api.get("/api/digital-books/bookshelf/mine"),
        api.get(`/api/digital-books/${digitalBookId}/reviews`),
      ]);
      setBook(bookRes.data);
      setEditTitle(bookRes.data.title || "");
      setEditAuthor(bookRes.data.author || "");
      setEditDescription(bookRes.data.description || "");

      const found = (shelfRes.data.items || []).find(
        (item: any) => item.digitalBookId === digitalBookId
      );
      setShelf(found || null);

      setReviewSummary(reviewsRes.data.summary);
      setReviewItems(reviewsRes.data.items || []);
      const mine = reviewsRes.data.mine;
      setReviewLocked(!!mine?.confirmed);
      if (mine) {
        setDraftRating(Number(mine.rating) || null);
        setDraftRecommend(
          mine.recommendScore === null || mine.recommendScore === undefined
            ? null
            : Number(mine.recommendScore)
        );
        setDraftComment(String(mine.comment || ""));
      } else {
        setDraftRating(null);
        setDraftRecommend(null);
        setDraftComment("");
      }
    } catch {
      setBook(null);
      setShelf(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [digitalBookId])
  );


  const openReader = () => {
    if (!shelf) return;
    navigation.navigate("PdfReader", {
      digitalBookId,
      title: book?.title || "Book",
      initialPage: Number(shelf?.lastPage) || 1,
      initialProgress: Number(shelf?.progress) || 0,
      totalPages: Number(shelf?.totalPages) || undefined,
      onBookshelf: true,
    });
  };

  const addToBookshelf = async () => {
    if (shelf || busy) return;
    setBusy(true);
    setModal({ visible: false, message: "" });

    let added: any = null;
    try {
      const res = await api.post(`/api/digital-books/${digitalBookId}/bookshelf`);
      added = res.data ?? {};
    } catch (error: any) {
      setBusy(false);
      setAddedModalOpen(false);
      setModal({
        visible: true,
        message: extractApiError(error, "Could not add to bookshelf"),
      });
      return;
    }

    setBusy(false);
    setShelf(added);
    setAddedModalOpen(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    safeInvalidateDigitalCache();
  };

  const removeFromBookshelf = async () => {
    setRemoveConfirmOpen(false);
    setModal({ visible: false, message: "" });
    setBusy(true);

    try {
      await api.delete(`/api/digital-books/${digitalBookId}/bookshelf`);
    } catch (error: any) {
      setBusy(false);
      setModal({
        visible: true,
        message: extractApiError(error, "Could not remove from bookshelf"),
      });
      return;
    }

    setBusy(false);
    setShelf(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    safeInvalidateDigitalCache();
  };

  const submitReview = async () => {
    setConfirmReviewOpen(false);
    setModal({ visible: false, message: "" });
    setBusy(true);

    try {
      await api.put(`/api/digital-books/${digitalBookId}/reviews`, {
        rating: draftRating,
        recommendScore: draftRecommend,
        comment: draftComment.trim(),
      });
    } catch (error: any) {
      setBusy(false);
      setModal({
        visible: true,
        message: extractApiError(error, "Could not save your review"),
      });
      return;
    }

    setBusy(false);
    setReviewLocked(true);
    setReviewSuccessOpen(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    void load({ silent: true });
  };

  const saveDigitalDetails = async () => {
    if (!editTitle.trim()) {
      setModal({ visible: true, message: "Title is required." });
      return;
    }
    setSavingDetails(true);
    try {
      const res = await api.patch(`/api/digital-books/${digitalBookId}`, {
        title: editTitle.trim(),
        author: editAuthor.trim(),
        description: editDescription.trim(),
      });
      setBook(res.data.book || { ...book, title: editTitle.trim(), author: editAuthor.trim(), description: editDescription.trim() });
      setEditingBook(false);
      setEditSuccess(true);
      safeInvalidateDigitalCache();
    } catch (error: any) {
      setModal({
        visible: true,
        message: extractApiError(error, "Could not save book details"),
      });
    } finally {
      setSavingDetails(false);
    }
  };

  const requestReviewConfirm = () => {
    if (!draftRating) {
      setModal({ visible: true, message: "Pick a star rating first." });
      return;
    }
    if (reviewLocked) return;
    setConfirmReviewOpen(true);
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

  const progress = Number(shelf?.progress ?? 0);
  const hasProgress = progress > 0;
  const publishedReviews = reviewItems;

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
              void load({ silent: true });
            }}
            tintColor={colors.navy}
          />
        }
      >
        <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: space.sm, marginLeft: -8 }} />

        <View style={{ alignItems: "center", marginBottom: space.lg }}>
          <BookCover uri={book.thumbnailUrl} width={140} height={200} />
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
            {book.author || "Unknown author"}
          </Text>
          {book.fileSizeBytes ? (
            <Text
              style={{
                marginTop: 4,
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
              }}
            >
              PDF Â· {Math.round(book.fileSizeBytes / 1024)} KB
            </Text>
          ) : null}
        </View>

        <Card style={{ marginBottom: space.md }}>
          {!shelf ? (
            <Button
              title="Add to Bookshelf"
              onPress={() => void addToBookshelf()}
              loading={busy}
            />
          ) : (
            <>
              <Button
                title={hasProgress ? "Continue reading" : "Read Book"}
                onPress={openReader}
              />
              <Button
                title="Remove from Bookshelf"
                variant="dangerSoft"
                onPress={() => setRemoveConfirmOpen(true)}
                loading={busy}
                style={{ marginTop: space.sm }}
              />
            </>
          )}
        </Card>

        {shelf ? (
          <Card style={{ marginBottom: space.md }}>
            <Text
              style={{
                fontFamily: fontFamily.bodyBold,
                fontSize: type.body,
                color: colors.navy,
                marginBottom: space.xs,
              }}
            >
              Reading progress
            </Text>
            <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
              {hasProgress
                ? `Page ${shelf?.lastPage || "?"} Â· ${progress}% read`
                : "Saved to your bookshelf. Open the book to start reading."}
            </Text>
            <View
              style={{
                marginTop: space.sm,
                height: 8,
                borderRadius: radius.pill,
                backgroundColor: colors.creamDark,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.min(Math.max(progress, 0), 100)}%`,
                  height: "100%",
                  backgroundColor: colors.navy,
                }}
              />
            </View>
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
              About
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

        {isStaff ? (
          <Card style={{ marginBottom: space.md }}>
            <PressableScale
              onPress={() => {
                setManageOpen((open) => {
                  if (open) setEditingBook(false);
                  return !open;
                });
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
                Manage this book
              </Text>
              <Ionicons name={manageOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.navy} />
            </PressableScale>
            {manageOpen ? (
              <View style={{ marginTop: space.md }}>
                {!editingBook ? (
                  <>
                    <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.text }}>
                      {book.title}
                    </Text>
                    <Text
                      style={{
                        marginTop: 4,
                        fontFamily: fontFamily.body,
                        fontSize: type.small,
                        color: colors.muted,
                      }}
                    >
                      {book.author || "No author"}
                    </Text>
                    <Button
                      title="Edit"
                      variant="secondary"
                      onPress={() => setEditingBook(true)}
                      style={{ marginTop: space.md }}
                    />
                  </>
                ) : (
                  <>
                    <Input label="Title" value={editTitle} onChangeText={setEditTitle} />
                    <Input label="Author" value={editAuthor} onChangeText={setEditAuthor} />
                    <Input
                      label="About / description"
                      value={editDescription}
                      onChangeText={setEditDescription}
                      multiline
                    />
                    <Button
                      title="Save details"
                      onPress={() => void saveDigitalDetails()}
                      loading={savingDetails}
                      style={{ marginBottom: space.sm }}
                    />
                    <Button title="Done editing" variant="softOutline" onPress={() => setEditingBook(false)} />
                  </>
                )}
              </View>
            ) : null}
          </Card>
        ) : null}

        <BookReviewSection
          locked={reviewLocked}
          busy={busy}
          draftRating={draftRating}
          draftRecommend={draftRecommend}
          onRating={setDraftRating}
          onRecommend={setDraftRecommend}
          onSave={requestReviewConfirm}
          summary={reviewSummary}
          items={publishedReviews}
          reviewsOpen={reviewsOpen}
          onToggleReviews={() => setReviewsOpen((v) => !v)}
        />
      </ScrollView>

      <AppModal
        visible={addedModalOpen}
        variant="success"
        title="Added to bookshelf"
        message="This book is now in your bookshelf. You can read it now or access it anytime from your shelf."
        confirmLabel="Done"
        onClose={() => setAddedModalOpen(false)}
      />
      <AppModal
        visible={removeConfirmOpen}
        variant="danger"
        title="Remove from bookshelf?"
        message="Your reading progress for this book will be cleared from your shelf."
        confirmLabel="Remove"
        confirmVariant="dangerSoft"
        cancelLabel="Keep it"
        onClose={() => setRemoveConfirmOpen(false)}
        onConfirm={() => void removeFromBookshelf()}
        onCancel={() => setRemoveConfirmOpen(false)}
      />
      <AppModal
        visible={confirmReviewOpen}
        variant="info"
        title="Submit your review?"
        message="Your rating and recommendation will be shared with other students."
        confirmLabel="Submit review"
        cancelLabel="Go back"
        onClose={() => setConfirmReviewOpen(false)}
        onConfirm={() => void submitReview()}
        onCancel={() => setConfirmReviewOpen(false)}
      />
      <AppModal
        visible={reviewSuccessOpen}
        variant="success"
        title="Review submitted"
        message="Thank you. Your review is now visible to other students."
        onClose={() => setReviewSuccessOpen(false)}
      />
      <AppModal
        visible={editSuccess}
        variant="success"
        title="Book updated"
        message="Title, author, and about text were saved."
        onClose={() => setEditSuccess(false)}
      />
      <AppModal
        visible={modal.visible}
        variant="error"
        title="Something went wrong"
        message={modal.message}
        confirmLabel="OK"
        onClose={() => setModal({ visible: false, message: "" })}
      />
    </>
  );
}
