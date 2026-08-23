import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { SearchBar } from "../components/SearchBar";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { BookCover, Badge, Button, Chip } from "../components/ui";
import { useProfile } from "../context/ProfileContext";
import { type PaginatedResponse } from "../types/pagination";
import { getCatalogPageSize } from "../utils/appConfig";
import {
  catalogCacheKey,
  getCatalogCache,
  invalidateCatalogCache,
  setCatalogCache,
} from "../utils/catalogCache";
import { useTheme } from "../theme";

type CatalogBook = {
  isbn: string;
  title: string;
  authors?: string[];
  thumbnailUrl?: string;
  availableCount?: number;
  totalCopies?: number;
  availability?: string;
  isActive?: boolean;
};

type SortOption = "title_asc" | "title_desc" | "newest";
type AvailabilityFilter = "all" | "available" | "reserved" | "issued" | "unavailable";
type ViewMode = "list" | "grid";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  embedded?: boolean;
  initialQuery?: string;
};

export default function CatalogScreen({
  navigation,
  embedded = false,
  initialQuery = "",
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, fontFamily, radius, space, type } = useTheme();
  const { isStaff } = useProfile();

  const [query, setQuery] = useState(initialQuery);
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sort, setSort] = useState<SortOption>("title_asc");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftSort, setDraftSort] = useState<SortOption>("title_asc");
  const [draftAvailability, setDraftAvailability] = useState<AvailabilityFilter>("all");
  const [pageSize, setPageSize] = useState(10);

  const filtersActive = sort !== "title_asc" || availability !== "all";

  useEffect(() => {
    void getCatalogPageSize().then(setPageSize);
  }, []);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  const loadBooks = useCallback(
    async (opts?: {
      search?: string;
      pageNum?: number;
      staff?: boolean;
      sortBy?: SortOption;
      availabilityFilter?: AvailabilityFilter;
      skipCache?: boolean;
      silent?: boolean;
    }) => {
      const search = opts?.search ?? query;
      const pageNum = opts?.pageNum ?? page;
      const staff = opts?.staff ?? isStaff;
      const sortBy = opts?.sortBy ?? sort;
      const availabilityFilter = opts?.availabilityFilter ?? availability;
      const size = pageSize || (await getCatalogPageSize());

      const cacheKey = catalogCacheKey({
        q: search.trim(),
        page: pageNum,
        pageSize: size,
        sort: sortBy,
        availability: availabilityFilter !== "all" ? availabilityFilter : undefined,
        includeInactive: staff ? "1" : undefined,
      });

      if (!opts?.skipCache) {
        const cached = getCatalogCache<CatalogBook>(cacheKey);
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

      if (!opts?.silent) {
        setLoading(true);
      }

      try {
        const response = await api.get<PaginatedResponse<CatalogBook>>("/api/catalog/books", {
          params: {
            page: pageNum,
            pageSize: size,
            sort: sortBy,
            ...(search.trim() ? { q: search.trim() } : {}),
            ...(availabilityFilter !== "all" ? { availability: availabilityFilter } : {}),
            ...(staff ? { includeInactive: "1" } : {}),
          },
        });
        setBooks(response.data.results || []);
        setPage(response.data.page || pageNum);
        setTotalPages(response.data.totalPages || 0);
        setTotal(response.data.total || 0);
        setCatalogCache(cacheKey, response.data);
      } catch {
        setBooks([]);
        setTotalPages(0);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, page, isStaff, sort, availability, pageSize]
  );

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      loadBooks({ pageNum: 1, silent: false });
    }, [isStaff, pageSize])
  );

  const runSearch = (search: string) => {
    setPage(1);
    loadBooks({ search, pageNum: 1 });
  };

  const changePage = (next: number) => {
    if (next < 1 || (totalPages > 0 && next > totalPages)) return;
    setPage(next);
    loadBooks({ pageNum: next });
  };

  const openFilters = () => {
    setDraftSort(sort);
    setDraftAvailability(availability);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setFiltersOpen(false);
    if (draftSort === sort && draftAvailability === availability) return;
    setSort(draftSort);
    setAvailability(draftAvailability);
    setPage(1);
    loadBooks({
      sortBy: draftSort,
      availabilityFilter: draftAvailability,
      pageNum: 1,
    });
  };

  const resetFilters = () => {
    setDraftSort("title_asc");
    setDraftAvailability("all");
  };

  const renderBook = ({ item }: { item: CatalogBook }) => {
    const tone =
      item.availability === "Available"
        ? "success"
        : item.availability === "Reserved"
          ? "warning"
          : "muted";

    if (viewMode === "grid") {
      return (
        <Pressable
          style={[styles.gridCard, { backgroundColor: colors.white, borderColor: colors.border }]}
          onPress={() => navigation.navigate("BookDetail", { isbn: item.isbn })}
        >
          <BookCover uri={item.thumbnailUrl} width={120} height={120} style={{ alignSelf: "center" }} />
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
          <Badge label={item.availability || "Unavailable"} tone={tone} style={{ marginTop: space.xs }} />
        </Pressable>
      );
    }

    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.white, borderColor: colors.border }]}
        onPress={() => navigation.navigate("BookDetail", { isbn: item.isbn })}
      >
        <BookCover uri={item.thumbnailUrl} width={56} height={84} />
        <View style={styles.cardBody}>
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
            {(item.authors || []).join(", ") || "Unknown author"}
          </Text>
          {item.isActive === false ? (
            <Text
              style={{
                marginTop: 6,
                color: colors.danger,
                fontSize: type.caption,
                fontFamily: fontFamily.bodySemiBold,
              }}
            >
              Inactive
            </Text>
          ) : null}
        </View>
        <View style={styles.badgeCol}>
          <Badge label={item.availability || "Unavailable"} tone={tone} />
          <Text
            style={{
              marginTop: 4,
              fontFamily: fontFamily.body,
              fontSize: type.caption,
              color: colors.muted,
            }}
          >
            {item.availableCount || 0}/{item.totalCopies || 0}
          </Text>
        </View>
      </Pressable>
    );
  };

  const sortChips: { id: SortOption; label: string }[] = [
    { id: "title_asc", label: "A–Z" },
    { id: "title_desc", label: "Z–A" },
    { id: "newest", label: "Newest" },
  ];

  const availabilityChips: { id: AvailabilityFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "available", label: "Available" },
    { id: "reserved", label: "Reserved" },
    { id: "issued", label: "Issued" },
  ];

  return (
    <View
      style={[
        styles.container,
        embedded ? styles.embedded : { paddingTop: insets.top + 12 },
        { backgroundColor: colors.cream },
      ]}
    >
      <View style={styles.controls}>
        {!embedded ? (
          <Text
            style={{
              fontFamily: fontFamily.display,
              fontSize: type.title,
              color: colors.navy,
              marginBottom: space.sm,
            }}
          >
            Catalog
          </Text>
        ) : null}

        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSearch={runSearch}
          searchOnDebounce={false}
        />

        <View style={styles.toolbar}>
          <Pressable
            onPress={openFilters}
            style={[
              styles.filtersBtn,
              {
                backgroundColor: colors.white,
                borderColor: filtersActive ? colors.navy : colors.border,
              },
            ]}
          >
            <Ionicons name="options-outline" size={18} color={colors.navy} />
            <Text
              style={{
                marginLeft: 6,
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.small,
                color: colors.navy,
              }}
            >
              Filters
            </Text>
            {filtersActive ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.amber,
                  marginLeft: 6,
                }}
              />
            ) : null}
          </Pressable>

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
          <SkeletonList rows={6} />
        ) : (
          <FlatList
            key={viewMode}
            style={styles.list}
            data={books}
            numColumns={viewMode === "grid" ? 2 : 1}
            keyExtractor={(item) => item.isbn}
            columnWrapperStyle={viewMode === "grid" ? styles.gridRow : undefined}
            contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  invalidateCatalogCache();
                  loadBooks({ pageNum: page, skipCache: true, silent: true });
                }}
                tintColor={colors.navy}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No copies found"
                message="Try another search, or ask a librarian to add titles."
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
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
          >
            <Text style={{ fontFamily: fontFamily.bodySemiBold, color: colors.navy }}>
              Previous
            </Text>
          </Pressable>
          <Text
            style={{
              fontFamily: fontFamily.body,
              fontSize: type.small,
              color: colors.muted,
            }}
          >
            Page {page} of {totalPages} · {total} titles
          </Text>
          <Pressable
            onPress={() => changePage(page + 1)}
            disabled={page >= totalPages}
            style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
          >
            <Text style={{ fontFamily: fontFamily.bodySemiBold, color: colors.navy }}>
              Next
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFiltersOpen(false)}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.cream,
                borderRadius: radius.lg,
                marginBottom: insets.bottom + 16,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{
                fontFamily: fontFamily.display,
                fontSize: type.titleSm,
                color: colors.navy,
                marginBottom: space.md,
              }}
            >
              Filters
            </Text>

            <Text
              style={{
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.small,
                color: colors.navy,
                marginBottom: space.sm,
              }}
            >
              Sort by
            </Text>
            <View style={styles.chipWrap}>
              {sortChips.map((c) => (
                <Chip
                  key={c.id}
                  label={c.label}
                  selected={draftSort === c.id}
                  onPress={() => setDraftSort(c.id)}
                  style={styles.chipItem}
                />
              ))}
            </View>

            <Text
              style={{
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.small,
                color: colors.navy,
                marginTop: space.md,
                marginBottom: space.sm,
              }}
            >
              Availability
            </Text>
            <View style={styles.chipWrap}>
              {availabilityChips.map((c) => (
                <Chip
                  key={c.id}
                  label={c.label}
                  selected={draftAvailability === c.id}
                  onPress={() => setDraftAvailability(c.id)}
                  style={styles.chipItem}
                />
              ))}
            </View>

            <View style={{ marginTop: space.lg, gap: space.sm }}>
              <Button title="Apply filters" onPress={applyFilters} />
              <Button title="Reset" variant="ghost" onPress={resetFilters} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  embedded: { paddingTop: 0 },
  controls: {
    flexShrink: 0,
    zIndex: 2,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  filtersBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  viewToggle: {
    flexDirection: "row",
    gap: 12,
    flexShrink: 0,
  },
  listArea: {
    flex: 1,
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  card: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
  },
  cardBody: { flex: 1, minWidth: 0 },
  badgeCol: { alignItems: "flex-end", justifyContent: "center", flexShrink: 0 },
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
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  pageBtnDisabled: { opacity: 0.35 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(46, 74, 98, 0.45)",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
  },
  modalCard: {
    padding: 20,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipItem: {
    marginBottom: 0,
  },
});
