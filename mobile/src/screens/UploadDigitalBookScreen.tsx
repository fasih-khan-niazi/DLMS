import React, { useEffect, useState } from "react";
import {
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { API_BASE_URL } from "../config/api";
import { firebaseAuth } from "../config/firebase";
import { Button, Input, BackButton } from "../components/ui";
import { AppModal } from "../components/AppModal";
import { invalidateDigitalCache } from "../utils/digitalCache";
import { getAppConfig, hydrateAppConfig, peekMaxPdfSizeMb } from "../utils/appConfig";
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
  const [maxMb, setMaxMb] = useState<number | null>(peekMaxPdfSizeMb());
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  useEffect(() => {
    void hydrateAppConfig().then((stored) => {
      if (stored) setMaxMb(stored.maxPdfSizeMb);
      void getAppConfig().then((cfg) => setMaxMb(cfg.maxPdfSizeMb));
    });
  }, []);

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
    const limit = maxMb ?? (await getAppConfig()).maxPdfSizeMb;
    if (file.size && file.size > limit * 1024 * 1024) {
      setModal({
        kind: "error",
        message: `This PDF is too large. Maximum size is ${limit} MB.`,
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
        message: "Your PDF is in the catalog. The cover is generated from the first page.",
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
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.cream }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: 56,
            paddingHorizontal: 20,
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: space.sm, marginLeft: -8 }} />

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
          {maxMb !== null ? (
            <Text
              style={{
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
                marginBottom: space.lg,
                lineHeight: 22,
              }}
            >
              PDFs are stored securely in the library cloud. Maximum file size: {maxMb} MB.
            </Text>
          ) : (
            <Text
              style={{
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
                marginBottom: space.lg,
                lineHeight: 22,
              }}
            >
              PDFs are stored securely in the library cloud.
            </Text>
          )}

          <Input label="Title" value={title} onChangeText={setTitle} placeholder="Book title" />
          <Input label="Author" value={author} onChangeText={setAuthor} placeholder="Author name" />
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Short summary"
            multiline
            style={{ minHeight: 110, textAlignVertical: "top", marginBottom: 4 }}
          />

          <Button
            title={file ? `Selected: ${file.name}` : "Choose PDF"}
            variant="secondary"
            onPress={pickPdf}
            style={{ marginTop: space.md, marginBottom: space.md }}
          />

          <Button title="Upload digital copy" onPress={upload} loading={loading} variant="amber" />
        </ScrollView>
      </KeyboardAvoidingView>

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
