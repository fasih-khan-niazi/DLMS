import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SearchInput } from "./ui/SearchInput";
import { useTheme } from "../theme";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
} from "../utils/recentSearches";
import { looksLikeIsbn } from "../utils/isbn";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  hint?: string;
  debounceMs?: number;
  /** When false, only search on submit (good for Home navigate). Default true. */
  searchOnDebounce?: boolean;
  showRecent?: boolean;
  showHint?: boolean;
};

export function SearchBar({
  value,
  onChangeText,
  onSearch,
  placeholder = "Search title, author, or ISBN",
  hint,
  debounceMs = 400,
  searchOnDebounce = true,
  showRecent = true,
  showHint = true,
}: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const [recent, setRecent] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  const loadRecent = useCallback(async () => {
    setRecent(await getRecentSearches());
  }, []);

  useEffect(() => {
    if (showRecent) void loadRecent();
  }, [showRecent, loadRecent]);

  useEffect(() => {
    if (!searchOnDebounce) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchRef.current(value.trim());
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, debounceMs, searchOnDebounce]);

  const submit = async (q: string) => {
    const trimmed = q.trim();
    if (showRecent && trimmed) {
      await addRecentSearch(trimmed);
      await loadRecent();
    }
    onSearch(trimmed);
  };

  const isbnHint = value.trim() && looksLikeIsbn(value);
  const hintText =
    hint ||
    (isbnHint
      ? "ISBN detected. Matching exact code."
      : "Search by title, author, or ISBN.");

  return (
    <View style={styles.wrap}>
      <SearchInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onSubmit={() => void submit(value)}
      />

      {showHint ? (
        <Text
          style={{
            marginTop: space.xs,
            fontFamily: fontFamily.body,
            fontSize: type.caption,
            color: colors.muted,
          }}
        >
          {hintText}
        </Text>
      ) : null}

      {showRecent && focused && recent.length > 0 ? (
        <View
          style={[
            styles.recentPanel,
            {
              backgroundColor: colors.white,
              borderColor: colors.border,
              marginTop: space.sm,
            },
          ]}
        >
          <View style={styles.recentHeader}>
            <Text
              style={{
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.small,
                color: colors.navy,
              }}
            >
              Recent searches
            </Text>
            <Pressable
              onPress={async () => {
                await clearRecentSearches();
                setRecent([]);
              }}
              hitSlop={8}
            >
              <Text
                style={{
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.caption,
                  color: colors.amberDark,
                }}
              >
                Clear
              </Text>
            </Pressable>
          </View>
          {recent.map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                onChangeText(item);
                void submit(item);
              }}
              style={styles.recentRow}
            >
              <Ionicons name="time-outline" size={16} color={colors.muted} />
              <Text
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontFamily: fontFamily.body,
                  fontSize: type.small,
                  color: colors.text,
                }}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  recentPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
});
