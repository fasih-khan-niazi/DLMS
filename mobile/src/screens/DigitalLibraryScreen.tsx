import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { SearchBar } from "../components/SearchBar";
import { BookCover } from "../components/ui";
import { EmptyState } from "../components/EmptyState";
import { SkeletonList } from "../components/Skeleton";
import { PAGE_SIZE, type PaginatedResponse } from "../types/pagination";
import { useTheme } from "../theme";

type DigitalBook = {
  digitalBookId: string;
  title: string;
  author?: string;
  fileSizeBytes?: number;
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
  embedded?: boolean;
};

export default function DigitalLibraryScreen({ navigation, embedded = false }: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<DigitalBook[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (search = query, pageNum = page) => {
      try {
        const response = await api.get<PaginatedResponse<DigitalBook>>("/api/digital-books", {
          params: {
            page: pageNum,
            pageSize: PAGE_SIZE,
            ...(search.trim() ? { q: search.trim() } : {}),
          },
        });
        setBooks(response.data.results || []);
        setPage(response.data.page || pageNum);
        setTotalPages(response.data.totalPages || 0);
      } catch {
        setBooks([]);
        setTotalPages(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, page]
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setPage(1);
      load("", 1);
    }, [])
  );

  const runSearch = (search: string) => {
    setLoading(true);
    setPage(1);
    load(search, 1);
  };

  const changePage = (next: number) => {
    if (next < 1 || (totalPages > 0 && next > totalPages)) return;
    setLoading(true);
    setPage(next);
    load(query, next);
  };

  return (
    <View
      style={[
        styles.container,
        embedded && styles.embedded,
        { backgroundColor: colors.cream },
      ]}
    >
      <View style={styles.controls}>
        {!embedded ? (
          <>
            <Pressable onPress={() => navigation.goBack()}>
              <Text
                style={{
                  color: colors.amberDark,
                  marginBottom: 12,
                  fontFamily: fontFamily.body,
                }}
              >
                ← Back
              </Text>
            </Pressable>
            <Text
              style={{
                fontFamily: fontFamily.display,
                fontSize: type.title,
                color: colors.navy,
                marginBottom: space.md,
              }}
            >
              Digital Copies
            </Text>
          </>
        ) : null}

        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSearch={runSearch}
          placeholder="Search digital copies"
        />
      </View>

      <View style={styles.listArea}>
        {loading ? (
          <SkeletonList rows={5} />
        ) : (
          <FlatList
            style={styles.list}
            data={books}
            keyExtractor={(item) => item.digitalBookId}
            contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load(query, page);
                }}
                tintColor={colors.navy}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No digital copies yet"
                message="Check back later for new uploads."
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.card, { backgroundColor: colors.white, borderColor: colors.border }]}
                onPress={() =>
                  navigation.navigate("DigitalBookDetail", {
                    digitalBookId: item.digitalBookId,
                  })
                }
              >
                <BookCover width={52} height={72} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodySemiBold,
                      fontSize: type.body,
                      color: colors.navy,
                    }}
                    numberOfLines={2}
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
                  <Text
                    style={{
                      marginTop: 2,
                      fontFamily: fontFamily.body,
                      fontSize: type.caption,
                      color: colors.muted,
                    }}
                  >
                    {item.fileSizeBytes
                      ? `${Math.round(item.fileSizeBytes / 1024)} KB PDF`
                      : "PDF"}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {!loading && totalPages > 1 ? (
        <View style={[styles.pagination, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => changePage(page - 1)}
            disabled={page <= 1}
            style={{ opacity: page <= 1 ? 0.35 : 1 }}
          >
            <Text style={{ fontFamily: fontFamily.bodySemiBold, color: colors.navy }}>
              Previous
            </Text>
          </Pressable>
          <Text style={{ fontFamily: fontFamily.body, fontSize: type.small, color: colors.muted }}>
            Page {page} of {totalPages}
          </Text>
          <Pressable
            onPress={() => changePage(page + 1)}
            disabled={page >= totalPages}
            style={{ opacity: page >= totalPages ? 0.35 : 1 }}
          >
            <Text style={{ fontFamily: fontFamily.bodySemiBold, color: colors.navy }}>
              Next
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  embedded: { paddingTop: 0 },
  controls: { flexShrink: 0 },
  listArea: { flex: 1, minHeight: 0 },
  list: { flex: 1 },
  card: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  pagination: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
