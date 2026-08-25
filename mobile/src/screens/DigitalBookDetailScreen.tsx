import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import api from "../config/api";
import { AppModal } from "../components/AppModal";
import { BookCover, Button, Card, BackButton } from "../components/ui";
import { BookDetailSkeleton } from "../components/Skeleton";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ params: { digitalBookId: string } }, "params">;
};

type ReviewSummary = {
  count: number;
  averageRating: number | null;
  recommendPercent: number | null;
  recommendLabel?: string | null;
};

type ReviewItem = {
  reviewId: string;
  displayName: string;
  rating: number;
  recommendScore: number | null;
  comment: string;
  updatedAt?: string;
  isMine?: boolean;
};

function formatReviewDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_seconds" in value) {
    return new Date((value as { _seconds: number })._seconds * 1000).toLocaleDateString();
  }
  if (typeof value === "string" || value instanceof Date) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
  }
  return "";
}

function StarRating({
  value,
  onSelect,
  disabled,
  size = 32,
}: {
  value: number | null;
  onSelect: (rating: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  const { colors, space } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onSelect(star)} disabled={disabled} hitSlop={8}>
          <Ionicons
            name={(value || 0) >= star ? "star" : "star-outline"}
            size={size}
            color={(value || 0) >= star ? colors.amber : colors.muted}
          />
        </Pressable>
      ))}
    </View>
  );
}

function NpsPicker({
  value,
  onSelect,
  disabled,
}: {
  value: number | null;
  onSelect: (score: number) => void;
  disabled?: boolean;
}) {
  const { colors, fontFamily, space, type, radius } = useTheme();

  const renderRow = (scores: number[]) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.xs }}>
      {scores.map((score) => {
        const selected = value === score;
        return (
          <Pressable
            key={score}
            disabled={disabled}
            onPress={() => onSelect(score)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: selected ? colors.navy : colors.border,
              backgroundColor: selected ? colors.navy : colors.white,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.small,
                color: selected ? colors.white : colors.navy,
              }}
            >
              {score}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={{ gap: space.sm }}>
      {renderRow([1, 2, 3, 4, 5])}
      {renderRow([6, 7, 8, 9, 10])}
    </View>
  );
}

export default function DigitalBookDetailScreen({ navigation, route }: Props) {
  const { digitalBookId } = route.params;
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

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [bookRes, shelfRes, reviewsRes] = await Promise.all([
        api.get(`/api/digital-books/${digitalBookId}`),
        api.get("/api/digital-books/bookshelf/mine"),
        api.get(`/api/digital-books/${digitalBookId}/reviews`),
      ]);
      setBook(bookRes.data);

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
    if (shelf) return;
    setBusy(true);
    try {
      const res = await api.post(`/api/digital-books/${digitalBookId}/bookshelf`);
      setShelf(res.data);
      setAddedModalOpen(true);
    } catch (error: any) {
      setModal({
        visible: true,
        message: error.response?.data?.error || "Could not add to bookshelf",
      });
    } finally {
      setBusy(false);
    }
  };

  const removeFromBookshelf = async () => {
    setRemoveConfirmOpen(false);
    setBusy(true);
    try {
      await api.delete(`/api/digital-books/${digitalBookId}/bookshelf`);
      setShelf(null);
    } catch (error: any) {
      setModal({
        visible: true,
        message: error.response?.data?.error || "Could not remove from bookshelf",
      });
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    setConfirmReviewOpen(false);
    setBusy(true);
    try {
      await api.put(`/api/digital-books/${digitalBookId}/reviews`, {
        rating: draftRating,
        recommendScore: draftRecommend,
        comment: draftComment.trim(),
      });
      setReviewLocked(true);
      setReviewSuccessOpen(true);
      await load({ silent: true });
    } catch (error: any) {
      setModal({
        visible: true,
        message: error.response?.data?.error || "Could not save your review",
      });
    } finally {
      setBusy(false);
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
              PDF · {Math.round(book.fileSizeBytes / 1024)} KB
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
                ? `Page ${shelf?.lastPage || "?"} · ${progress}% read`
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

        {!reviewLocked ? (
          <Card style={{ marginBottom: space.md }}>
            <Text
              style={{
                fontFamily: fontFamily.bodyBold,
                fontSize: type.body,
                color: colors.navy,
                marginBottom: space.xs,
              }}
            >
              How would you rate this book?
            </Text>
            <Text
              style={{
                marginBottom: space.sm,
                fontFamily: fontFamily.body,
                fontSize: type.caption,
                color: colors.muted,
              }}
            >
              Tap a star from 1 to 5
            </Text>
            <StarRating value={draftRating} onSelect={setDraftRating} disabled={busy} />
            <Text
              style={{
                marginTop: space.lg,
                marginBottom: space.xs,
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.small,
                color: colors.navy,
              }}
            >
              Would you recommend this book to your friends?
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: space.sm,
              }}
            >
              <Text style={{ fontFamily: fontFamily.body, fontSize: type.caption, color: colors.muted }}>
                1 · Not at all
              </Text>
              <Text style={{ fontFamily: fontFamily.body, fontSize: type.caption, color: colors.muted }}>
                10 · Definitely
              </Text>
            </View>
            <NpsPicker value={draftRecommend} onSelect={setDraftRecommend} disabled={busy} />
            <Button
              title="Save review"
              variant="secondary"
              onPress={requestReviewConfirm}
              loading={busy}
              style={{ marginTop: space.md }}
            />
          </Card>
        ) : (
          <Card style={{ marginBottom: space.md }}>
            <Text
              style={{
                fontFamily: fontFamily.bodyBold,
                fontSize: type.body,
                color: colors.navy,
                marginBottom: space.sm,
              }}
            >
              Your review
            </Text>
            <StarRating value={draftRating} onSelect={() => {}} disabled size={24} />
            {draftRecommend !== null ? (
              <Text
                style={{
                  marginTop: space.sm,
                  fontFamily: fontFamily.body,
                  fontSize: type.small,
                  color: colors.muted,
                }}
              >
                Recommend to friends: {draftRecommend}/10
              </Text>
            ) : null}
          </Card>
        )}

        {publishedReviews.length > 0 ? (
          <Card style={{ marginBottom: space.md }}>
            <Pressable
              onPress={() => setReviewsOpen((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <View>
                <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
                  Student reviews ({reviewSummary?.count ?? publishedReviews.length})
                </Text>
                {reviewSummary?.averageRating ? (
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: fontFamily.body,
                      fontSize: type.caption,
                      color: colors.muted,
                    }}
                  >
                    ★ {reviewSummary.averageRating}
                    {reviewSummary.recommendLabel
                      ? ` · ${reviewSummary.recommendLabel}`
                      : ""}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name={reviewsOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.muted}
              />
            </Pressable>

            {reviewsOpen ? (
              <View style={{ marginTop: space.md, gap: space.sm }}>
                {publishedReviews.map((review) => (
                  <View
                    key={review.reviewId}
                    style={{
                      padding: space.sm,
                      borderRadius: radius.md,
                      backgroundColor: colors.creamDark,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ fontFamily: fontFamily.bodyBold, color: colors.navy, flex: 1 }}>
                        {review.displayName}
                      </Text>
                      {formatReviewDate(review.updatedAt) ? (
                        <Text
                          style={{
                            fontFamily: fontFamily.body,
                            fontSize: type.caption,
                            color: colors.muted,
                          }}
                        >
                          {formatReviewDate(review.updatedAt)}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        marginTop: 4,
                        fontFamily: fontFamily.body,
                        fontSize: type.caption,
                        color: colors.amberDark,
                      }}
                    >
                      ★ {review.rating}/5
                      {review.recommendScore !== null
                        ? ` · Would recommend to friends: ${review.recommendScore}/10`
                        : ""}
                    </Text>
                    {review.comment ? (
                      <Text
                        style={{
                          marginTop: 6,
                          fontFamily: fontFamily.body,
                          fontSize: type.small,
                          color: colors.text,
                          lineHeight: 20,
                        }}
                      >
                        {review.comment}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      <AppModal
        visible={addedModalOpen}
        variant="success"
        title="Added to bookshelf"
        message="This book is saved. You can start reading now, or remove it anytime."
        confirmLabel="Read Book"
        cancelLabel="Remove from Bookshelf"
        onClose={() => setAddedModalOpen(false)}
        onConfirm={() => {
          setAddedModalOpen(false);
          openReader();
        }}
        onCancel={() => {
          setAddedModalOpen(false);
          setRemoveConfirmOpen(true);
        }}
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
