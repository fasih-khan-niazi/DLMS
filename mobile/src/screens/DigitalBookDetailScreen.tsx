import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import api from "../config/api";
import { BookCover, Button, Card } from "../components/ui";
import { downloadDigitalPdf, openOrSharePdf } from "../utils/digitalPdf";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ params: { digitalBookId: string } }, "params">;
};

function ProgressBar({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const { colors, radius, space, fontFamily, type } = useTheme();
  const steps = [0, 25, 50, 75, 100];

  return (
    <View>
      <View
        style={{
          height: 10,
          borderRadius: radius.pill,
          backgroundColor: colors.creamDark,
          overflow: "hidden",
          marginBottom: space.sm,
        }}
      >
        <View
          style={{
            width: `${Math.min(Math.max(value, 0), 100)}%`,
            height: "100%",
            backgroundColor: colors.navy,
            borderRadius: radius.pill,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {steps.map((step) => (
          <Pressable key={step} onPress={() => onChange(step)} hitSlop={8}>
            <Text
              style={{
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.caption,
                color: value >= step ? colors.navy : colors.muted,
              }}
            >
              {step}%
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function StarRating({
  value,
  onSelect,
  disabled,
}: {
  value: number | null;
  onSelect: (rating: number) => void;
  disabled?: boolean;
}) {
  const { colors, space } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (value || 0) >= star;
        return (
          <Pressable key={star} onPress={() => onSelect(star)} disabled={disabled} hitSlop={8}>
            <Ionicons
              name={filled ? "star" : "star-outline"}
              size={32}
              color={filled ? colors.amber : colors.muted}
            />
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const bookRes = await api.get(`/api/digital-books/${digitalBookId}`);
      setBook(bookRes.data);

      const shelfRes = await api.get("/api/digital-books/bookshelf/mine");
      const found = (shelfRes.data.items || []).find(
        (item: any) => item.digitalBookId === digitalBookId
      );
      setShelf(found || null);
      setProgress(Number(found?.progress ?? 0));
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

  const openPdf = async () => {
    setBusy(true);
    setDownloadProgress(0);
    try {
      await ensureOnBookshelf();
      const uri = await downloadDigitalPdf(
        digitalBookId,
        book?.title || "book",
        (p) => setDownloadProgress(p)
      );
      await openOrSharePdf(uri);
      await load({ silent: true });
    } catch (error: any) {
      Alert.alert("Could not open PDF", error.message || "Download failed");
    } finally {
      setBusy(false);
      setDownloadProgress(null);
    }
  };

  const saveProgress = async (next: number) => {
    setProgress(next);
    setBusy(true);
    try {
      await ensureOnBookshelf();
      const res = await api.patch(`/api/digital-books/${digitalBookId}/bookshelf`, {
        progress: next,
      });
      setShelf(res.data);
    } catch (error: any) {
      Alert.alert("Save failed", error.response?.data?.error || "Could not save progress");
    } finally {
      setBusy(false);
    }
  };

  const setRating = async (rating: number) => {
    setBusy(true);
    try {
      await ensureOnBookshelf();
      const res = await api.patch(`/api/digital-books/${digitalBookId}/bookshelf`, {
        rating,
      });
      setShelf(res.data);
    } catch (error: any) {
      Alert.alert("Save failed", error.response?.data?.error || "Could not save rating");
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

  const hasProgress = (shelf?.progress ?? progress) > 0;

  return (
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
        <BookCover width={140} height={200} />
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
            Continue reading
          </Text>
          <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
            You are {shelf?.progress ?? progress}% through this book.
          </Text>
        </Card>
      ) : null}

      <Card style={{ marginBottom: space.md }}>
        <Button
          title={hasProgress ? "Continue reading" : "Open PDF"}
          onPress={openPdf}
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
          Reading progress
        </Text>
        <ProgressBar value={progress} onChange={(next) => void saveProgress(next)} />
        <Button
          title="Save progress"
          variant="secondary"
          onPress={() => void saveProgress(progress)}
          loading={busy}
          style={{ marginTop: space.md }}
        />
      </Card>

      <Card style={{ marginBottom: space.md }}>
        <Text
          style={{
            fontFamily: fontFamily.bodyBold,
            fontSize: type.body,
            color: colors.navy,
            marginBottom: space.sm,
          }}
        >
          Your rating
        </Text>
        <StarRating
          value={shelf?.rating ?? null}
          onSelect={(rating) => void setRating(rating)}
          disabled={busy}
        />
        <Text
          style={{
            marginTop: space.sm,
            fontFamily: fontFamily.body,
            fontSize: type.caption,
            color: colors.muted,
          }}
        >
          {shelf?.rating ? `You rated this ${shelf.rating}/5` : "Tap a star to rate"}
        </Text>
      </Card>
    </ScrollView>
  );
}
