import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";

type CatalogBook = {
  isbn: string;
  title: string;
  authors?: string[];
  availableCount?: number;
  totalCopies?: number;
  availability?: string;
  thumbnailUrl?: string;
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function CatalogScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBooks = async (search = query) => {
    try {
      const response = await api.get("/api/catalog/books", {
        params: search.trim() ? { q: search.trim() } : {},
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
      loadBooks();
    }, [])
  );

  const onSearch = () => {
    setLoading(true);
    loadBooks(query);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Library Catalog</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search title, author, or ISBN"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={onSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#2E4A62" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.isbn}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadBooks();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No books found. Try another search.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("BookDetail", { isbn: item.isbn })}
            >
              <View style={styles.cardBody}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>
                  {(item.authors || []).join(", ") || "Unknown author"}
                </Text>
                <Text style={styles.meta}>ISBN: {item.isbn}</Text>
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
    backgroundColor: "#F8F7F4",
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2E4A62",
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1F2937",
  },
  searchButton: {
    backgroundColor: "#2E4A62",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardBody: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E4A62",
  },
  meta: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 13,
  },
  badge: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  badgeText: {
    color: "#E8A838",
    fontWeight: "700",
    fontSize: 13,
  },
  countText: {
    marginTop: 4,
    color: "#6BA3A8",
    fontSize: 12,
  },
  empty: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 40,
  },
});
