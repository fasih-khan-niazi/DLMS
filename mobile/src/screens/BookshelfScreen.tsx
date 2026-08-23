import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function BookshelfScreen({ navigation }: Props) {
  const [items, setItems] = useState<any[]>([]);
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
      load();
    }, [])
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>My Bookshelf</Text>

      {loading ? (
        <ActivityIndicator color="#2E4A62" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
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
            <Text style={styles.empty}>
              No saved digital copies yet. Browse Digital Copies in Catalog and save one.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.getParent()?.navigate("Catalog", {
                  screen: "DigitalBookDetail",
                  params: { digitalBookId: item.digitalBookId },
                })
              }
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.author || "Unknown author"}</Text>
              <Text style={styles.meta}>Progress: {item.progress ?? 0}%</Text>
              <Text style={styles.meta}>
                Rating: {item.rating ? `${item.rating}/5` : "Not rated"}
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
  back: { color: "#E8A838", marginBottom: 12, fontSize: 16 },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2E4A62",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#2E4A62" },
  meta: { marginTop: 4, color: "#6B7280" },
  empty: { textAlign: "center", color: "#6B7280", marginTop: 40 },
});
