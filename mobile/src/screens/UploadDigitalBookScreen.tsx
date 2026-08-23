import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";
import { Button, Input, Card } from "../components/ui";
import { AppModal } from "../components/AppModal";
import { invalidateDigitalCache } from "../utils/digitalCache";
import { getAppConfig, invalidateAppConfigCache } from "../utils/appConfig";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type ModalState =
  | { kind: "none" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function UploadDigitalBookScreen({ navigation }: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [maxMb, setMaxMb] = useState(25);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  useFocusEffect(
    React.useCallback(() => {
      invalidateAppConfigCache();
      void getAppConfig(true).then((cfg) => setMaxMb(cfg.maxPdfSizeMb));
    }, [])
  );

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
      setModal({ kind: "error", message: "Title is required." });
      return;
    }
    if (!file) {
      setModal({ kind: "error", message: "Choose a PDF file first." });
      return;
    }
    if (file.size && file.size > maxMb * 1024 * 1024) {
      setModal({
        kind: "error",
        message: `This PDF is too large. Maximum size is ${maxMb} MB (change in admin Config).`,
      });
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
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      invalidateDigitalCache();
      setModal({
        kind: "success",
        message: "Your PDF is in the catalog. A cover was generated from the first page.",
      });
    } catch (error: any) {
      setModal({ kind: "error", message: error.message || "Upload failed. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    if (modal.kind === "success") {
      navigation.getParent()?.navigate("Catalog", {
        screen: "CatalogMain",
        params: { initialTab: "digitalCopies" },
      });
    }
    setModal({ kind: "none" });
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.cream }}
        contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40 }}
      >
        <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: space.md }}>
          <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>← Back</Text>
        </Pressable>

        <Text
          style={{
            fontFamily: fontFamily.display,
            fontSize: type.titleSm,
            color: colors.navy,
            marginBottom: space.xs,
          }}
        >
          Upload digital copy
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.body,
            fontSize: type.small,
            color: colors.muted,
            marginBottom: space.lg,
            lineHeight: 22,
          }}
        >
          PDFs are stored securely in the library cloud. Maximum file size: {maxMb} MB (set in admin
          Config).
        </Text>

        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Book title" />
        <Input label="Author" value={author} onChangeText={setAuthor} placeholder="Author name" />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Short summary"
          multiline
          style={{ minHeight: 90, textAlignVertical: "top" }}
        />

        <Card style={{ marginBottom: space.md }}>
          <Button
            title={file ? `Selected: ${file.name}` : "Choose PDF"}
            variant="secondary"
            onPress={pickPdf}
          />
        </Card>

        <Button title="Upload digital copy" onPress={upload} loading={loading} variant="amber" />
      </ScrollView>

      <AppModal
        visible={modal.kind === "success"}
        variant="success"
        title="Upload complete"
        message={modal.kind === "success" ? modal.message : ""}
        onClose={closeModal}
      />
      <AppModal
        visible={modal.kind === "error"}
        variant="error"
        title="Upload failed"
        message={modal.kind === "error" ? modal.message : ""}
        confirmLabel="OK"
        onClose={closeModal}
      />
    </>
  );
}
