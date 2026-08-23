import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import api from "../config/api";
import { AppModal } from "../components/AppModal";
import { BookCover, Button, Card } from "../components/ui";
import { downloadDigitalPdf } from "../utils/digitalPdf";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ params: { digitalBookId: string } }, "params">;
};

type ReviewSummary = {
  count: number;
  averageRating: number | null;
  recommendPercent: number | null;
};

type ReviewItem = {
  reviewId: string;
  displayName: string;
  rating: number;
  recommendScore: number | null;
  comment: string;
  isMine?: boolean;
};

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
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
      {Array.from({ length: 11 }, (_, i) => i).map((score) => {
        const selected = value === score;
        return (
          <Pressable
            key={score}
            disabled={disabled}
            onPress={() => onSelect(score)}
            style={{
              minWidth: 36,
              paddingVertical: 8,
              paddingHorizontal: 6,
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
                fontSize: type.caption,
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
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
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
      if (mine) {
        setDraftRating(Number(mine.rating) || null);
        setDraftRecommend(
          mine.recommendScore === null || mine.recommendScore === undefined
            ? null
            : Number(mine.recommendScore)
        );
        setDraftComment(String(mine.comment || ""));
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

  const ensureOnBookshelf = async () => {
    if (shelf) return shelf;
    const res = await api.post(`/api/digital-books/${digitalBookId}/bookshelf`);
    setShelf(res.data);
    return res.data;
  };

  const openReader = async () => {
    setBusy(true);
    setDownloadProgress(0);
    try {
      await ensureOnBookshelf();
      await downloadDigitalPdf(digitalBookId, book?.title || "book", (p) => setDownloadProgress(p));
      navigation.navigate("PdfReader", {
        digitalBookId,
        title: book?.title || "Book",
        initialPage: Number(shelf?.lastPage) || 1,
        initialProgress: Number(shelf?.progress) || 0,
        totalPages: Number(shelf?.totalPages) || undefined,
      });
    } catch (error: any) {
      setModal({ visible: true, message: error.message || "Could not open reader" });
    } finally {
      setBusy(false);
      setDownloadProgress(null);
    }
  };

  const saveReview = async () => {
    if (!draftRating) {
      setModal({ visible: true, message: "Pick a star rating first." });
      return;
    }
    setBusy(true);
    try {
      await ensureOnBookshelf();
      await api.put(`/api/digital-books/${digitalBookId}/reviews`, {
        rating: draftRating,
        recommendScore: draftRecommend,
        comment: draftComment.trim(),
      });
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

  if (loading && !book) {
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

  const progress = Number(shelf?.progress ?? 0);
  const hasProgress = progress > 0 && progress < 100;
  const otherReviews = reviewItems.filter((r) => !r.isMine);

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
        <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: space.md }}>
          <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>← Back</Text>
        </Pressable>

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

        {hasProgress ? (
          <Card style={{ marginBottom: space.md }}>
            <Text
              style={{
                fontFamily: fontFamily.bodyBold,
                fontSize: type.body,
                color: colors.navy,
                marginBottom: space.xs,
              }}
            >
              Continue where you left off
            </Text>
            <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
              Page {shelf?.lastPage || "?"} · {progress}% read
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
                  width: `${progress}%`,
                  height: "100%",
                  backgroundColor: colors.navy,
                }}
              />
            </View>
          </Card>
        ) : null}

        <Card style={{ marginBottom: space.md }}>
          <Button
            title={hasProgress ? "Continue reading" : "Read in app"}
            onPress={openReader}
            loading={busy && downloadProgress === null}
          />
          {downloadProgress !== null ? (
            <View style={{ marginTop: space.sm }}>
              <View
                style={{
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: colors.creamDark,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${Math.round(downloadProgress * 100)}%`,
                    height: "100%",
                    backgroundColor: colors.amber,
                  }}
                />
              </View>
              <Text
                style={{
                  marginTop: 6,
                  textAlign: "center",
                  fontFamily: fontFamily.body,
                  fontSize: type.caption,
                  color: colors.muted,
                }}
              >
                Downloading… {Math.round(downloadProgress * 100)}%
              </Text>
            </View>
          ) : null}
        </Card>

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
          <StarRating value={draftRating} onSelect={setDraftRating} disabled={busy} />
          <Text
            style={{
              marginTop: space.md,
              marginBottom: space.sm,
              fontFamily: fontFamily.bodySemiBold,
              fontSize: type.small,
              color: colors.navy,
            }}
          >
            Would you recommend this book to your friends?
          </Text>
          <Text
            style={{
              marginBottom: space.sm,
              fontFamily: fontFamily.body,
              fontSize: type.caption,
              color: colors.muted,
            }}
          >
            0 = not at all · 10 = definitely
          </Text>
          <NpsPicker value={draftRecommend} onSelect={setDraftRecommend} disabled={busy} />
          <Button
            title="Save review"
            variant="secondary"
            onPress={() => void saveReview()}
            loading={busy}
            style={{ marginTop: space.md }}
          />
        </Card>

        {(reviewSummary?.count ?? 0) > 0 ? (
          <Card style={{ marginBottom: space.md }}>
            <Pressable
              onPress={() => setReviewsOpen((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <View>
                <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
                  Student reviews ({reviewSummary?.count})
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
                    ★ {reviewSummary.averageRating} average
                    {reviewSummary.recommendPercent !== null
                      ? ` · ${reviewSummary.recommendPercent}% would recommend`
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
                {otherReviews.length === 0 ? (
                  <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
                    No reviews from other students yet.
                  </Text>
                ) : (
                  otherReviews.map((review) => (
                    <View
                      key={review.reviewId}
                      style={{
                        padding: space.sm,
                        borderRadius: radius.md,
                        backgroundColor: colors.creamDark,
                      }}
                    >
                      <Text style={{ fontFamily: fontFamily.bodyBold, color: colors.navy }}>
                        {review.displayName}
                      </Text>
                      <Text
                        style={{
                          marginTop: 4,
                          fontFamily: fontFamily.body,
                          fontSize: type.caption,
                          color: colors.amberDark,
                        }}
                      >
                        ★ {review.rating}/5
                        {review.recommendScore !== null ? ` · Recommend ${review.recommendScore}/10` : ""}
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
                  ))
                )}
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

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
