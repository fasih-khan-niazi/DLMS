import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { BookCover, Card, BackButton } from "../components/ui";
import { EmptyState } from "../components/EmptyState";
import { SkeletonList } from "../components/Skeleton";
import { useTheme } from "../theme";

type BookshelfItem = {
  digitalBookId: string;
  title: string;
  author?: string;
  progress?: number;
  rating?: number;
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

function ProgressPill({ value }: { value: number }) {
  const { colors, radius, fontFamily, type } = useTheme();
  const pct = Math.min(Math.max(value, 0), 100);

  return (
    <View style={{ marginTop: 8 }}>
      <View
        style={{
          height: 6,
          borderRadius: radius.pill,
          backgroundColor: colors.creamDark,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: colors.navy,
          }}
        />
      </View>
      <Text
        style={{
          marginTop: 4,
          fontFamily: fontFamily.body,
          fontSize: type.caption,
          color: colors.muted,
        }}
      >
        {pct}% read
      </Text>
    </View>
  );
}

export default function BookshelfScreen({ navigation }: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const [items, setItems] = useState<BookshelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const response = await api.get("/api/digital-books/bookshelf/mine");
      setItems(response.data.items || []);
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
      void load();
    }, [])
  );

  const openDetail = (digitalBookId: string) => {
    navigation.getParent()?.navigate("Catalog", {
      screen: "DigitalBookDetail",
      params: { digitalBookId },
    });
  };

  const inProgress = items.filter((item) => (item.progress ?? 0) > 0 && (item.progress ?? 0) < 100);
  const finished = items.filter((item) => (item.progress ?? 0) >= 100);
  const notStarted = items.filter((item) => !item.progress);

  const renderItem = (item: BookshelfItem) => (
    <Pressable
      key={item.digitalBookId}
      onPress={() => openDetail(item.digitalBookId)}
      style={{ marginBottom: space.sm }}
    >
      <Card>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <BookCover width={56} height={84} />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: fontFamily.bodyBold,
                fontSize: type.body,
                color: colors.navy,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
              }}
            >
              {item.author || "Unknown author"}
            </Text>
            {(item.progress ?? 0) > 0 ? (
              <ProgressPill value={item.progress ?? 0} />
            ) : (
              <Text
                style={{
                  marginTop: 8,
                  fontFamily: fontFamily.body,
                  fontSize: type.caption,
                  color: colors.muted,
                }}
              >
                Not started
              </Text>
            )}
            {item.rating ? (
              <Text
                style={{
                  marginTop: 4,
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.caption,
                  color: colors.amberDark,
                }}
              >
                ★ {item.rating}/5
              </Text>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: 56, paddingHorizontal: 20 }}>
      <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: space.sm, marginLeft: -8 }} />
      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: type.titleSm,
          color: colors.navy,
          marginBottom: space.md,
        }}
      >
        My Bookshelf
      </Text>

      {loading ? (
        <SkeletonList rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          message="Open a digital copy from Catalog and your progress will appear here."
        />
      ) : (
        <FlatList
          data={[{ key: "content" }]}
          keyExtractor={(item) => item.key}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.navy}
            />
          }
          renderItem={() => (
            <View>
              {inProgress.length > 0 ? (
                <View style={{ marginBottom: space.lg }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.body,
                      color: colors.navy,
                      marginBottom: space.sm,
                    }}
                  >
                    Continue reading
                  </Text>
                  {inProgress.map(renderItem)}
                </View>
              ) : null}

              {notStarted.length > 0 ? (
                <View style={{ marginBottom: space.lg }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.body,
                      color: colors.navy,
                      marginBottom: space.sm,
                    }}
                  >
                    Saved
                  </Text>
                  {notStarted.map(renderItem)}
                </View>
              ) : null}

              {finished.length > 0 ? (
                <View style={{ marginBottom: space.lg }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.body,
                      color: colors.navy,
                      marginBottom: space.sm,
                    }}
                  >
                    Finished
                  </Text>
                  {finished.map(renderItem)}
                </View>
              ) : null}
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}
