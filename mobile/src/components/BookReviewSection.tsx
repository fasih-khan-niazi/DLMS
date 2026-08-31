import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, PressableScale } from "./ui";
import { useTheme } from "../theme";

export type ReviewSummary = {
  count: number;
  averageRating: number | null;
  recommendPercent: number | null;
  recommendLabel?: string | null;
};

export type ReviewItem = {
  reviewId: string;
  displayName: string;
  rating: number;
  recommendScore: number | null;
  comment: string;
  updatedAt?: unknown;
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
        <PressableScale
          key={star}
          onPress={() => onSelect(star)}
          disabled={disabled}
          hitSlop={8}
          haptic="selection"
        >
          <Ionicons
            name={(value || 0) >= star ? "star" : "star-outline"}
            size={size}
            color={(value || 0) >= star ? colors.amber : colors.muted}
          />
        </PressableScale>
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
          <PressableScale
            key={score}
            disabled={disabled}
            haptic="selection"
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
          </PressableScale>
        );
      })}
    </View>
  );

  return (
    <View style={{ gap: space.xs }}>
      {renderRow([1, 2, 3, 4, 5])}
      {renderRow([6, 7, 8, 9, 10])}
    </View>
  );
}

type Props = {
  locked: boolean;
  busy?: boolean;
  draftRating: number | null;
  draftRecommend: number | null;
  onRating: (n: number) => void;
  onRecommend: (n: number) => void;
  onSave: () => void;
  summary: ReviewSummary | null;
  items: ReviewItem[];
  reviewsOpen: boolean;
  onToggleReviews: () => void;
};

export function BookReviewSection({
  locked,
  busy,
  draftRating,
  draftRecommend,
  onRating,
  onRecommend,
  onSave,
  summary,
  items,
  reviewsOpen,
  onToggleReviews,
}: Props) {
  const { colors, fontFamily, space, type, radius } = useTheme();

  return (
    <>
      {!locked ? (
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
            One review per person. After you submit, it cannot be edited.
          </Text>
          <StarRating value={draftRating} onSelect={onRating} disabled={busy} />
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
          <NpsPicker value={draftRecommend} onSelect={onRecommend} disabled={busy} />
          <Button
            title="Save review"
            variant="secondary"
            onPress={onSave}
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

      {items.length > 0 ? (
        <Card style={{ marginBottom: space.md }}>
          <PressableScale
            onPress={onToggleReviews}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View>
              <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
                Student reviews ({summary?.count ?? items.length})
              </Text>
              {summary?.averageRating ? (
                <Text
                  style={{
                    marginTop: 4,
                    fontFamily: fontFamily.body,
                    fontSize: type.caption,
                    color: colors.muted,
                  }}
                >
                  ★ {summary.averageRating}/5
                  {summary.recommendLabel ? ` · ${summary.recommendLabel}` : ""}
                </Text>
              ) : null}
            </View>
            <Ionicons
              name={reviewsOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color={colors.muted}
            />
          </PressableScale>

          {reviewsOpen ? (
            <View style={{ marginTop: space.md, gap: space.sm }}>
              {items.map((review) => (
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
    </>
  );
}
