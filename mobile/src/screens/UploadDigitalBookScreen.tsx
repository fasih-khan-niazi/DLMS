import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api, { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function UploadDigitalBookScreen({ navigation }: Props) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setFile(result.assets[0]);
    }
  };

  const upload = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    if (!file) {
      Alert.alert("Error", "Choose a PDF file first");
      return;
    }

    setLoading(true);
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const form = new FormData();
      form.append("title", title.trim());
      form.append("author", author.trim());
      form.append("description", description.trim());
      form.append("file", {
        uri: file.uri,
        name: file.name || "book.pdf",
        type: file.mimeType || "application/pdf",
      } as any);

      const response = await fetch(`${API_BASE_URL}/api/digital-books`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      Alert.alert("Uploaded", "PDF added to E-Library");
      navigation.navigate("DigitalLibrary");
    } catch (error: any) {
      Alert.alert("Upload failed", error.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>Upload PDF</Text>
      <Text style={styles.hint}>
        Files are stored on your PC API server (local uploads folder), max 25MB.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#9CA3AF"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Author"
        placeholderTextColor="#9CA3AF"
        value={author}
        onChangeText={setAuthor}
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description"
        placeholderTextColor="#9CA3AF"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <TouchableOpacity style={styles.secondaryButton} onPress={pickPdf}>
        <Text style={styles.secondaryButtonText}>
          {file ? `Selected: ${file.name}` : "Choose PDF"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={upload} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Upload to E-Library</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F4" },
  content: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40 },
  back: { color: "#E8A838", marginBottom: 16, fontSize: 16 },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2E4A62",
    marginBottom: 8,
  },
  hint: { color: "#6B7280", marginBottom: 16, lineHeight: 18 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1F2937",
    marginBottom: 12,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryButtonText: { color: "#2E4A62", fontWeight: "600" },
  button: {
    backgroundColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
