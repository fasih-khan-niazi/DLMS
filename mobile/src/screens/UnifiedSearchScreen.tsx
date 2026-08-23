import React, { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../config/api";
import { BookCover, Badge, Screen } from "../components/ui";
import { EmptyState } from "../components/EmptyState";
import { SkeletonList } from "../components/Skeleton";
import { CATALOG_TABS } from "../constants/catalogTabs";
import { getCatalogPageSize } from "../utils/appConfig";
import { type PaginatedResponse } from "../types/pagination";
import { useTheme } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ UnifiedSearch: { query: string } }, "UnifiedSearch">;
};

type PhysicalHit = {
  isbn: string;
  title: string;
  authors?: string[];
  thumbnailUrl?: string;
  availability?: string;
};

type DigitalHit = {
  digitalBookId: string;
  title: string;
  author?: string;
};

export default function UnifiedSearchScreen({ navigation, route }: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const query = (route.params?.query || "").trim();
  const [physical, setPhysical] = useState<PhysicalHit[]>([]);
  const [digital, setDigital] = useState<DigitalHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!query) {
      setPhysical([]);
      setDigital([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const size = await getCatalogPageSize();
      const [physRes, digRes] = await Promise.all([
        api.get<PaginatedResponse<PhysicalHit>>("/api/catalog/books", {
          params: { q: query, page: 1, pageSize: size },
        }),
        api.get<PaginatedResponse<DigitalHit>>("/api/digital-books", {
          params: { q: query, page: 1, pageSize: size },
        }),
      ]);
      setPhysical(physRes.data.results || []);
      setDigital(digRes.data.results || []);
    } catch {
      setPhysical([]);
      setDigital([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const empty = !loading && physical.length === 0 && digital.length === 0;

  return (
    <Screen
      scroll
      contentStyle={{ paddingHorizontal: 20 }}
      // refresh via pull is optional; keep simple
    >
      <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: space.md }}>
        <Text style={{ color: colors.amberDark, fontFamily: fontFamily.bodySemiBold }}>
          ← Back
        </Text>
      </Pressable>

      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: type.titleSm,
          color: colors.navy,
          marginBottom: 4,
        }}
      >
        Search results
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.body,
          fontSize: type.small,
          color: colors.muted,
          marginBottom: space.lg,
        }}
      >
        “{query}” in physical and digital copies
      </Text>

      {loading ? (
        <SkeletonList rows={5} />
      ) : empty ? (
        <EmptyState title="No matches" message="Try a different title, author, or ISBN." />
      ) : (
        <View>
          <Text
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: type.body,
              color: colors.navy,
              marginBottom: space.sm,
            }}
          >
            {CATALOG_TABS.physicalCopies.label}
          </Text>
          {physical.length === 0 ? (
            <Text
              style={{
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
                marginBottom: space.lg,
              }}
            >
              No physical copies matched.
            </Text>
          ) : (
            physical.map((item) => (
              <Pressable
                key={item.isbn}
                onPress={() =>
                  navigation.getParent()?.navigate("Catalog", {
                    screen: "BookDetail",
                    params: { isbn: item.isbn },
                  })
                }
                style={{
                  flexDirection: "row",
                  gap: 12,
                  backgroundColor: colors.white,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <BookCover uri={item.thumbnailUrl} width={52} height={72} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodySemiBold,
                      color: colors.navy,
                      fontSize: type.body,
                    }}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: fontFamily.body,
                      fontSize: type.small,
                      color: colors.muted,
                    }}
                    numberOfLines={1}
                  >
                    {(item.authors || []).join(", ") || "Unknown author"}
                  </Text>
                </View>
                <Badge
                  label={item.availability || "Unavailable"}
                  tone={item.availability === "Available" ? "success" : "muted"}
                />
              </Pressable>
            ))
          )}

          <Text
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: type.body,
              color: colors.navy,
              marginTop: space.md,
              marginBottom: space.sm,
            }}
          >
            {CATALOG_TABS.digitalCopies.label}
          </Text>
          {digital.length === 0 ? (
            <Text
              style={{
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
              }}
            >
              No digital copies matched.
            </Text>
          ) : (
            digital.map((item) => (
              <Pressable
                key={item.digitalBookId}
                onPress={() =>
                  navigation.getParent()?.navigate("Catalog", {
                    screen: "DigitalBookDetail",
                    params: { digitalBookId: item.digitalBookId },
                  })
                }
                style={{
                  flexDirection: "row",
                  gap: 12,
                  backgroundColor: colors.white,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <BookCover width={52} height={72} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodySemiBold,
                      color: colors.navy,
                      fontSize: type.body,
                    }}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: fontFamily.body,
                      fontSize: type.small,
                      color: colors.muted,
                    }}
                  >
                    {item.author || "Unknown author"}
                  </Text>
                </View>
              </Pressable>
            ))
          )}

          {refreshing ? null : (
            <Pressable
              onPress={() => {
                setRefreshing(true);
                load();
              }}
              style={{ marginTop: space.lg, alignSelf: "center", padding: 8 }}
            >
              <Text style={{ fontFamily: fontFamily.bodySemiBold, color: colors.navy }}>
                Refresh results
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </Screen>
  );
}
