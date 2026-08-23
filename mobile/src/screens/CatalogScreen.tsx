import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { colors, radius, space, type } from "../theme";
import { useProfile } from "../context/ProfileContext";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

type CatalogBook = {
  isbn: string;
  title: string;
  authors?: string[];
  availableCount?: number;
  totalCopies?: number;
  availability?: string;
  isActive?: boolean;
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
  embedded?: boolean;
};

export default function CatalogScreen({ navigation, embedded = false }: Props) {
  const insets = useSafeAreaInsets();
  const { isStaff } = useProfile();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBooks = async (search = query, staff = isStaff) => {
    try {
      const response = await api.get("/api/catalog/books", {
        params: {
          ...(search.trim() ? { q: search.trim() } : {}),
          ...(staff ? { includeInactive: "1" } : {}),
        },
      });
      setBooks(response.data.results || []);
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadBooks(query, isStaff);
    }, [isStaff])
  );

  const onSearch = () => {
    setLoading(true);
    loadBooks(query);
  };

  return (
    <View
      style={[
        styles.container,
        embedded ? styles.embedded : { paddingTop: insets.top + 12 },
      ]}
    >
      {!embedded ? <Text style={styles.heading}>Catalog</Text> : null}

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search title, author, or ISBN"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={onSearch} activeOpacity={0.85}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonList rows={6} />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.isbn}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadBooks();
              }}
              tintColor={colors.navy}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No books found"
              message="Try another search, or ask a librarian to add titles."
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("BookDetail", { isbn: item.isbn })}
              activeOpacity={0.85}
            >
              <View style={styles.cardBody}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>
                  {(item.authors || []).join(", ") || "Unknown author"}
                </Text>
                <Text style={styles.meta}>ISBN: {item.isbn}</Text>
                {item.isActive === false ? (
                  <Text style={styles.inactiveLabel}>Inactive (hidden from students)</Text>
                ) : null}
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.availability || "Unavailable"}</Text>
                <Text style={styles.countText}>
                  {item.availableCount || 0}/{item.totalCopies || 0} free
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 20,
  },
  embedded: {
    paddingTop: 0,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: type.body,
  },
  searchButton: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchButtonText: {
    color: colors.white,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: 12,
  },
  cardBody: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
  },
  meta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: type.small,
  },
  inactiveLabel: {
    marginTop: 6,
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "700",
  },
  badge: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 88,
  },
  badgeText: {
    color: colors.amberDark,
    fontWeight: "700",
    fontSize: 12,
  },
  countText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
  },
});
