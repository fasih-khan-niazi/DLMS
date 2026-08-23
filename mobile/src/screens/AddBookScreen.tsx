import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function AddBookScreen({ navigation }: Props) {
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [category, setCategory] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [useGoogleBooks, setUseGoogleBooks] = useState(true);
  const [loading, setLoading] = useState(false);

  const lookupIsbn = async () => {
    if (!isbn.trim()) {
      Alert.alert("Error", "Enter an ISBN first");
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/api/catalog/lookup/${isbn.trim()}`);
      setTitle(response.data.title || "");
      setAuthors((response.data.authors || []).join(", "));
      setCategory((response.data.categories || [])[0] || "");
      if (response.data.thumbnailUrl) setCoverUrl(response.data.thumbnailUrl);
      Alert.alert("Found", "Metadata loaded from Google Books");
    } catch (error: any) {
      Alert.alert(
        "Manual entry needed",
        error.response?.data?.error || "No metadata found. Fill the fields manually."
      );
      setUseGoogleBooks(false);
    } finally {
      setLoading(false);
    }
  };

  const saveBook = async () => {
    if (!isbn.trim()) {
      Alert.alert("Error", "ISBN is required");
      return;
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      Alert.alert("Error", "Quantity must be at least 1");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/catalog/books", {
        isbn: isbn.trim(),
        title: title.trim() || undefined,
        authors: authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        categories: category.trim() ? [category.trim()] : [],
        useGoogleBooks,
        ...(coverUrl.trim() ? { thumbnailUrl: coverUrl.trim() } : {}),
      });

      const copiesResponse = await api.post("/api/catalog/copies", {
        isbn: isbn.trim(),
        quantity: qty,
      });

      Alert.alert(
        "Success",
        `Book saved with ${copiesResponse.data.createdCount} copy/copies.`
      );
      navigation.getParent()?.navigate("Catalog");
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to save book");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Add Book</Text>

      <TextInput
        style={styles.input}
        placeholder="ISBN"
        placeholderTextColor="#9CA3AF"
        value={isbn}
        onChangeText={setIsbn}
        autoCapitalize="characters"
      />

      <TouchableOpacity style={styles.secondaryButton} onPress={lookupIsbn} disabled={loading}>
        <Text style={styles.secondaryButtonText}>Lookup ISBN</Text>
      </TouchableOpacity>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Prefer Google Books metadata</Text>
        <Switch value={useGoogleBooks} onValueChange={setUseGoogleBooks} />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#9CA3AF"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Authors (comma separated)"
        placeholderTextColor="#9CA3AF"
        value={authors}
        onChangeText={setAuthors}
      />
      <TextInput
        style={styles.input}
        placeholder="Category"
        placeholderTextColor="#9CA3AF"
        value={category}
        onChangeText={setCategory}
      />
      <TextInput
        style={styles.input}
        placeholder="Cover image URL (optional)"
        placeholderTextColor="#9CA3AF"
        value={coverUrl}
        onChangeText={setCoverUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>
        Google Books fills the cover when available. Paste a URL here, or upload from the book detail screen after saving.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Number of physical copies"
        placeholderTextColor="#9CA3AF"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
      />

      <TouchableOpacity style={styles.button} onPress={saveBook} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save Book + Copies</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7F4",
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  back: {
    color: "#E8A838",
    marginBottom: 16,
    fontSize: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2E4A62",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1F2937",
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  switchLabel: {
    color: "#4B5563",
    flex: 1,
    paddingRight: 12,
  },
  hint: {
    color: "#6B7280",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: "#2E4A62",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
