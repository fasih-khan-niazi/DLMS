import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import api from "../config/api";
import { downloadDigitalPdf, openOrSharePdf } from "../utils/digitalPdf";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ params: { digitalBookId: string } }, "params">;
};

export default function DigitalBookDetailScreen({ navigation, route }: Props) {
  const { digitalBookId } = route.params;
  const [book, setBook] = useState<any>(null);
  const [shelf, setShelf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState("0");

  const load = async () => {
    try {
      const bookRes = await api.get(`/api/digital-books/${digitalBookId}`);
      setBook(bookRes.data);

      const shelfRes = await api.get("/api/digital-books/bookshelf/mine");
      const found = (shelfRes.data.items || []).find(
        (item: any) => item.digitalBookId === digitalBookId
      );
      setShelf(found || null);
      setProgressText(String(found?.progress ?? 0));
    } catch {
      setBook(null);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [digitalBookId])
  );

  const saveToBookshelf = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/api/digital-books/${digitalBookId}/bookshelf`);
      setShelf(res.data);
      Alert.alert("Saved", "Added to your bookshelf");
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const openPdf = async () => {
    setBusy(true);
    try {
      if (!shelf) {
        await api.post(`/api/digital-books/${digitalBookId}/bookshelf`);
      }
      const uri = await downloadDigitalPdf(digitalBookId, book?.title || "book");
      await openOrSharePdf(uri);
      await load();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not open PDF");
    } finally {
      setBusy(false);
    }
  };

  const saveProgress = async () => {
    const progress = Number(progressText);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      Alert.alert("Error", "Progress must be 0-100");
      return;
    }
    setBusy(true);
    try {
      if (!shelf) {
        await api.post(`/api/digital-books/${digitalBookId}/bookshelf`);
      }
      const res = await api.patch(`/api/digital-books/${digitalBookId}/bookshelf`, {
        progress,
      });
      setShelf(res.data);
      Alert.alert("Saved", `Progress set to ${progress}%`);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to save progress");
    } finally {
      setBusy(false);
    }
  };

  const setRating = async (rating: number) => {
    setBusy(true);
    try {
      if (!shelf) {
        await api.post(`/api/digital-books/${digitalBookId}/bookshelf`);
      }
      const res = await api.patch(`/api/digital-books/${digitalBookId}/bookshelf`, {
        rating,
      });
      setShelf(res.data);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to save rating");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2E4A62" />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Book not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{book.title}</Text>
      <Text style={styles.meta}>{book.author || "Unknown author"}</Text>
      {!!book.description && <Text style={styles.description}>{book.description}</Text>}

      <TouchableOpacity style={styles.primaryButton} onPress={openPdf} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Download / Open PDF</Text>
        )}
      </TouchableOpacity>

      {!shelf && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={saveToBookshelf}
          disabled={busy}
        >
          <Text style={styles.secondaryButtonText}>Save to Bookshelf</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.section}>Reading progress (0-100%)</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.progressInput}
          keyboardType="number-pad"
          value={progressText}
          onChangeText={setProgressText}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity style={styles.saveButton} onPress={saveProgress} disabled={busy}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.meta}>Current: {shelf?.progress ?? 0}%</Text>

      <Text style={styles.section}>Rating</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            style={[
              styles.starButton,
              shelf?.rating === star && styles.starActive,
            ]}
            onPress={() => setRating(star)}
            disabled={busy}
          >
            <Text
              style={[
                styles.starText,
                shelf?.rating === star && styles.starTextActive,
              ]}
            >
              {star}★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F4" },
  content: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F7F4",
  },
  back: { color: "#E8A838", marginBottom: 16, fontSize: 16 },
  title: { fontSize: 26, fontWeight: "700", color: "#2E4A62" },
  meta: { marginTop: 6, color: "#6B7280" },
  description: { marginTop: 12, color: "#4B5563", lineHeight: 22 },
  primaryButton: {
    marginTop: 20,
    backgroundColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#2E4A62", fontWeight: "600" },
  section: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "700",
    color: "#2E4A62",
  },
  row: { flexDirection: "row", gap: 10 },
  progressInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1F2937",
  },
  saveButton: {
    backgroundColor: "#E8A838",
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  ratingRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  starButton: {
    borderWidth: 1,
    borderColor: "#2E4A62",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  starActive: { backgroundColor: "#2E4A62" },
  starText: { color: "#2E4A62", fontWeight: "600" },
  starTextActive: { color: "#fff" },
  error: { color: "#B91C1C", marginBottom: 12 },
  link: { color: "#E8A838" },
});
