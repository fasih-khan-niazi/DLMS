import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useTheme } from "../theme";
import CatalogScreen from "./CatalogScreen";
import DigitalLibraryScreen from "./DigitalLibraryScreen";

type CatalogTab = "physical" | "ebooks";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ CatalogMain: { initialTab?: CatalogTab } }, "CatalogMain">;
};

export default function CatalogHubScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, fontFamily, radius, space, type } = useTheme();
  const [tab, setTab] = useState<CatalogTab>(route.params?.initialTab || "physical");

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
        {(
          [
            { id: "physical" as const, label: "Physical books" },
            { id: "ebooks" as const, label: "E-books" },
          ] as const
        ).map((item) => {
          const selected = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              style={[
                styles.segment,
                {
                  backgroundColor: selected ? colors.navy : colors.white,
                  borderColor: selected ? colors.navy : colors.border,
                  borderRadius: radius.pill,
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
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panel}>
        {tab === "physical" ? (
          <CatalogScreen navigation={navigation} embedded />
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
