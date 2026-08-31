import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Switch } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { AppModal } from "../components/AppModal";
import { BackButton, Button, Input } from "../components/ui";
import { invalidateCatalogCache } from "../utils/catalogCache";
import { extractApiError, runSideEffect } from "../utils/apiError";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type Feedback = {
  variant: "success" | "error" | "info";
  title: string;
  message: string;
  goCatalog?: boolean;
};

export default function AddBookScreen({ navigation }: Props) {
  const { colors, fontFamily, space, type, mode } = useTheme();
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [category, setCategory] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [useGoogleBooks, setUseGoogleBooks] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null as unknown as Feedback);

  const lookupIsbn = async () => {
    if (!isbn.trim()) {
      setFeedback({
        variant: "info",
        title: "ISBN required",
        message: "Enter an ISBN first, then tap Lookup.",
      });
      return;
    }

    setLoading(true);
    let data: any;
    try {
      const response = await api.get(`/api/catalog/lookup/${isbn.trim()}`);
      data = response.data;
    } catch (error: any) {
      setLoading(false);
      setUseGoogleBooks(false);
      setFeedback({
        variant: "info",
        title: "Manual entry needed",
        message: extractApiError(error, "No metadata found. Fill the fields manually."),
      });
      return;
    }

    setLoading(false);
    setTitle(data?.title || "");
    setAuthors((data?.authors || []).join(", "));
    setCategory((data?.categories || [])[0] || "");
    if (data?.thumbnailUrl) setCoverUrl(data.thumbnailUrl);
    setFeedback({
      variant: "success",
      title: "Details found",
      message: "Book details were filled in automatically. Review them before saving.",
    });
  };

  const saveBook = async () => {
    if (!isbn.trim()) {
      setFeedback({
        variant: "info",
        title: "ISBN required",
        message: "Enter the ISBN printed on the book.",
      });
      return;
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setFeedback({
        variant: "info",
        title: "Check the copy count",
        message: "Number of physical copies must be a whole number of 1 or more.",
      });
      return;
    }

    setLoading(true);
    let createdCount = qty;
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
      createdCount = Number(copiesResponse.data?.createdCount) || qty;
    } catch (error: any) {
      setLoading(false);
      setFeedback({
        variant: "error",
        title: "Could not save book",
        message: extractApiError(error, "Failed to save book"),
      });
      return;
    }

    setLoading(false);
    setFeedback({
      variant: "success",
      title: "Book added",
      message: `Saved with ${createdCount} ${createdCount === 1 ? "copy" : "copies"}. Print shelf labels from the book detail screen.`,
      goCatalog: true,
    });
    runSideEffect(invalidateCatalogCache);
  };

  const closeFeedback = () => {
    const goCatalog = feedback?.goCatalog;
    setFeedback(null as unknown as Feedback);
    if (goCatalog) navigation.getParent()?.navigate("Catalog");
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.cream }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton
          onPress={() => navigation.goBack()}
          style={{ marginBottom: space.sm, marginLeft: -8 }}
        />

        <Text
          style={{
            fontFamily: fontFamily.display,
            fontSize: type.title,
            color: colors.navy,
            marginBottom: space.lg,
          }}
        >
          Add Book
        </Text>

        <Input
          label="ISBN"
          placeholder="Scan or type the ISBN"
          value={isbn}
          onChangeText={setIsbn}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Button
          title="Lookup ISBN"
          variant="secondary"
          onPress={() => void lookupIsbn()}
          loading={loading}
          style={{ marginBottom: space.md }}
        />

        <View style={styles.switchRow}>
          <Text
            style={{
              flex: 1,
              paddingRight: space.md,
              fontFamily: fontFamily.body,
              fontSize: type.small,
              color: colors.text,
            }}
          >
            Fill details automatically when available
          </Text>
          <Switch
            value={useGoogleBooks}
            onValueChange={setUseGoogleBooks}
            trackColor={{ false: colors.border, true: colors.amber }}
            thumbColor={mode === "dark" ? "#F8F7F4" : "#FFFFFF"}
          />
        </View>

        <Input label="Title" placeholder="Book title" value={title} onChangeText={setTitle} />
        <Input
          label="Authors"
          placeholder="Separate multiple authors with commas"
          value={authors}
          onChangeText={setAuthors}
        />
        <Input
          label="Category"
          placeholder="For example: Fiction"
          value={category}
          onChangeText={setCategory}
        />
        <Input
          label="Cover image URL (optional)"
          placeholder="https://..."
          value={coverUrl}
          onChangeText={setCoverUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text
          style={{
            marginBottom: space.md,
            fontFamily: fontFamily.body,
            fontSize: type.caption,
            color: colors.muted,
            lineHeight: 18,
          }}
        >
          A cover is added automatically when available. You can also paste a URL here, or upload
          an image from the book detail screen after saving.
        </Text>

        <Input
          label="Number of physical copies"
          placeholder="1"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
        />

        <Button
          title="Save book and copies"
          onPress={() => void saveBook()}
          loading={loading}
          style={{ marginTop: space.sm }}
        />
      </ScrollView>

      <AppModal
        visible={!!feedback}
        variant={feedback?.variant || "info"}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        confirmLabel="Done"
        onClose={closeFeedback}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
});
