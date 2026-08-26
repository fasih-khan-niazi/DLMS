import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import {
  CATALOG_TABS,
  DEFAULT_CATALOG_TAB,
  type CatalogTab,
} from "../constants/catalogTabs";
import { useTheme } from "../theme";
import CatalogScreen from "./CatalogScreen";
import DigitalLibraryScreen from "./DigitalLibraryScreen";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<
    { CatalogMain: { initialTab?: CatalogTab; searchQuery?: string } },
    "CatalogMain"
  >;
};

const TAB_ORDER: CatalogTab[] = ["physicalCopies", "digitalCopies"];

export default function CatalogHubScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, fontFamily, radius, space, type } = useTheme();
  const [tab, setTab] = useState<CatalogTab>(route.params?.initialTab || DEFAULT_CATALOG_TAB);

  useEffect(() => {
    if (route.params?.initialTab) {
      setTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.cream, paddingTop: insets.top + 12 },
      ]}
    >
      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: type.title,
          color: colors.navy,
          marginBottom: space.md,
          paddingHorizontal: 20,
        }}
      >
        Catalog
      </Text>

      <View style={[styles.segments, { paddingHorizontal: 20, marginBottom: space.sm }]}>
        {TAB_ORDER.map((id) => {
          const selected = tab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              onPressIn={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              style={({ pressed }) => [
                styles.segment,
                {
                  backgroundColor: selected ? colors.navy : colors.white,
                  borderColor: selected ? colors.navy : colors.border,
                  borderRadius: radius.pill,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.white : colors.navy,
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.small,
                }}
              >
                {CATALOG_TABS[id].label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panel}>
        {tab === "physicalCopies" ? (
          <CatalogScreen
            navigation={navigation}
            embedded
            initialQuery={route.params?.searchQuery || ""}
          />
        ) : (
          <DigitalLibraryScreen navigation={navigation} embedded />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  segments: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  panel: { flex: 1 },
});
