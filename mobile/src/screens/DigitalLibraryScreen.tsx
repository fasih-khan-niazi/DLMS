import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { SearchBar } from "../components/SearchBar";
import { BookCover, Badge } from "../components/ui";
import { EmptyState } from "../components/EmptyState";
import { SkeletonList } from "../components/Skeleton";
import { useProfile } from "../context/ProfileContext";
import { type PaginatedResponse } from "../types/pagination";
import { getCatalogPageSize } from "../utils/appConfig";
import {
  digitalCacheKey,
  getDigitalCache,
  invalidateDigitalCache,
  setDigitalCache,
} from "../utils/digitalCache";
import { useTheme } from "../theme";

type DigitalBook = {
  digitalBookId: string;
  title: string;
  author?: string;
  fileSizeBytes?: number;
  description?: string;
};

type ViewMode = "list" | "grid";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  embedded?: boolean;
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return "PDF";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function DigitalLibraryScreen({ navigation, embedded = false }: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const { isStaff } = useProfile();

  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<DigitalBook[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    void getCatalogPageSize().then(setPageSize);
  }, []);

  const load = useCallback(
    async (opts?: {
      search?: string;
      pageNum?: number;
      skipCache?: boolean;
      silent?: boolean;
    }) => {
      const search = opts?.search ?? query;
      const pageNum = opts?.pageNum ?? page;
      const size = pageSize || (await getCatalogPageSize());

      const cacheKey = digitalCacheKey({
        q: search.trim(),
        page: pageNum,
        pageSize: size,
      });

      if (!opts?.skipCache) {
        const cached = getDigitalCache<DigitalBook>(cacheKey);
        if (cached) {
          setBooks(cached.results || []);
          setPage(cached.page || pageNum);
          setTotalPages(cached.totalPages || 0);
          setTotal(cached.total || 0);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      if (!opts?.silent) setLoading(true);

      try {
        const response = await api.get<PaginatedResponse<DigitalBook>>("/api/digital-books", {
          params: {
            page: pageNum,
            pageSize: size,
            ...(search.trim() ? { q: search.trim() } : {}),
          },
        });
        setBooks(response.data.results || []);
        setPage(response.data.page || pageNum);
        setTotalPages(response.data.totalPages || 0);
        setTotal(response.data.total || 0);
        setDigitalCache(cacheKey, response.data);
      } catch {
        setBooks([]);
        setTotalPages(0);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, page, pageSize]
  );

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      load({ pageNum: 1 });
    }, [pageSize])
  );

  const runSearch = (search: string) => {
    setPage(1);
    load({ search, pageNum: 1 });
  };

  const changePage = (next: number) => {
    if (next < 1 || (totalPages > 0 && next > totalPages)) return;
    setPage(next);
    load({ pageNum: next });
  };

  const openBook = (digitalBookId: string) => {
    navigation.navigate("DigitalBookDetail", { digitalBookId });
  };

  const renderBook = ({ item }: { item: DigitalBook }) => {
    if (viewMode === "grid") {
      return (
        <Pressable
          style={[styles.gridCard, { backgroundColor: colors.white, borderColor: colors.border }]}
          onPress={() => openBook(item.digitalBookId)}
        >
          <BookCover width={120} height={120} style={{ alignSelf: "center" }} />
          <Text
            numberOfLines={2}
            style={{
              marginTop: space.sm,
              fontFamily: fontFamily.bodySemiBold,
              fontSize: type.small,
              color: colors.navy,
            }}
          >
            {item.title}
          </Text>
          <Badge label="PDF" tone="muted" style={{ marginTop: space.xs }} />
        </Pressable>
      );
    }

    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.white, borderColor: colors.border }]}
        onPress={() => openBook(item.digitalBookId)}
      >
        <BookCover width={56} height={84} />
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
            numberOfLines={1}
          >
            {item.author || "Unknown author"}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontFamily: fontFamily.body,
              fontSize: type.caption,
              color: colors.muted,
            }}
          >
            {formatFileSize(item.fileSizeBytes)}
          </Text>
        </View>
        <Badge label="PDF" tone="default" />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, embedded && styles.embedded, { backgroundColor: colors.cream }]}>
      <View style={styles.controls}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSearch={runSearch}
          placeholder="Search digital copies"
          searchOnDebounce={false}
        />

        <View style={styles.toolbar}>
          {isStaff ? (
            <Pressable
              onPress={() => navigation.navigate("UploadDigitalBook")}
              style={[
                styles.uploadBtn,
                { backgroundColor: colors.amber, borderRadius: 999 },
              ]}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={colors.navy} />
              <Text
                style={{
                  marginLeft: 6,
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.small,
                  color: colors.navy,
                }}
              >
                Upload PDF
              </Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <View style={styles.viewToggle}>
            <Pressable onPress={() => setViewMode("list")} hitSlop={8}>
              <Ionicons
                name="list"
                size={22}
                color={viewMode === "list" ? colors.navy : colors.muted}
              />
            </Pressable>
            <Pressable onPress={() => setViewMode("grid")} hitSlop={8}>
              <Ionicons
                name="grid"
                size={22}
                color={viewMode === "grid" ? colors.navy : colors.muted}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.listArea}>
        {loading ? (
          <SkeletonList rows={5} />
        ) : (
          <FlatList
            key={viewMode}
            style={styles.list}
            data={books}
            numColumns={viewMode === "grid" ? 2 : 1}
            keyExtractor={(item) => item.digitalBookId}
            columnWrapperStyle={viewMode === "grid" ? styles.gridRow : undefined}
            contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  invalidateDigitalCache();
                  load({ pageNum: page, skipCache: true, silent: true });
                }}
                tintColor={colors.navy}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No digital copies yet"
                message={
                  isStaff
                    ? "Upload a PDF to add the first digital copy."
                    : "Check back later for new uploads."
                }
                actionLabel={isStaff ? "Upload PDF" : undefined}
                onAction={isStaff ? () => navigation.navigate("UploadDigitalBook") : undefined}
              />
            }
            renderItem={renderBook}
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
            Page {page} of {totalPages} · {total} titles
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
  container: { flex: 1, paddingHorizontal: 20 },
  embedded: { paddingTop: 0 },
  controls: { flexShrink: 0 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  viewToggle: { flexDirection: "row", gap: 12 },
  listArea: { flex: 1, minHeight: 0 },
  list: { flex: 1 },
  card: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  gridRow: { gap: 10 },
  gridCard: {
    flex: 1,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    maxWidth: "48%",
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
