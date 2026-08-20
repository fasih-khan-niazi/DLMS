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

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function DigitalLibraryScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (search = query) => {
    try {
      const response = await api.get("/api/digital-books", {
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
      load();
    }, [])
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>E-Library</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search digital books"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => {
            setLoading(true);
            load(query);
          }}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => {
            setLoading(true);
            load(query);
          }}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#2E4A62" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.digitalBookId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No digital books yet.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate("DigitalBookDetail", {
                  digitalBookId: item.digitalBookId,
                })
              }
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.author || "Unknown author"}</Text>
              <Text style={styles.meta}>
                {item.fileSizeBytes
                  ? `${Math.round(item.fileSizeBytes / 1024)} KB`
                  : "PDF"}
              </Text>
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
  back: {
    color: "#E8A838",
    marginBottom: 12,
    fontSize: 16,
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
    color: "#1F2937",
  },
  searchButton: {
    backgroundColor: "#2E4A62",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E4A62",
  },
  meta: {
    marginTop: 4,
    color: "#6B7280",
  },
  empty: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 40,
  },
});
