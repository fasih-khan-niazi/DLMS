import React, { useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Button } from "./ui/Button";
import { useTheme } from "../theme";
import { setOnboardingDone } from "../utils/onboarding";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Slide = {
  key: string;
  icon: IoniconName;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: "scan-borrow",
    icon: "qr-code-outline",
    title: "Scan to borrow",
    body: "Open the Scan tab, point your camera at a shelf QR label, and borrow in one tap.",
  },
  {
    key: "scan-return",
    icon: "return-down-back-outline",
    title: "Return via Scan",
    body: "Switch to Return mode on the Scan tab and scan the same copy label when you bring a book back.",
  },
  {
    key: "reserve",
    icon: "bookmark-outline",
    title: "Reserve when unavailable",
    body: "If every copy is checked out, reserve the title from Catalog. We will notify you when a copy is ready.",
  },
  {
    key: "fines",
    icon: "alert-circle-outline",
    title: "Fines block new loans",
    body: "Unpaid fines must be cleared at the desk before you can borrow or reserve again.",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function OnboardingCarousel({ visible, onClose }: Props) {
  const { colors, fontFamily, space, type, radius, mode } = useTheme();
  const width = Dimensions.get("window").width;
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const slides = useMemo(() => SLIDES, []);
  const last = index === slides.length - 1;

  const finish = async () => {
    await setOnboardingDone();
    onClose();
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const goNext = () => {
    if (last) {
      void finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    setIndex((i) => i + 1);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => void finish()}>
      <View style={[styles.backdrop, { backgroundColor: "rgba(26, 42, 62, 0.55)" }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cream,
              borderRadius: radius.lg,
              borderColor: colors.border,
            },
          ]}
        >
          <FlatList
            ref={listRef}
            data={slides}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            renderItem={({ item }) => (
              <View style={{ width: width - 48, paddingHorizontal: 8, alignItems: "center" }}>
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: mode === "dark" ? "rgba(232,168,56,0.15)" : "rgba(26,42,62,0.08)",
                    marginBottom: space.md,
                  }}
                >
                  <Ionicons name={item.icon} size={36} color={mode === "dark" ? colors.amber : colors.navy} />
                </View>
                <Text
                  style={{
                    fontFamily: fontFamily.display,
                    fontSize: type.titleSm,
                    color: colors.navy,
                    textAlign: "center",
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    marginTop: space.sm,
                    fontFamily: fontFamily.body,
                    fontSize: type.body,
                    color: colors.muted,
                    textAlign: "center",
                    lineHeight: 24,
                    paddingHorizontal: 8,
                  }}
                >
                  {item.body}
                </Text>
              </View>
            )}
          />

          <View style={styles.dots}>
            {slides.map((slide, i) => (
              <View
                key={slide.key}
                style={{
                  width: i === index ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  marginHorizontal: 3,
                  backgroundColor: i === index ? colors.amber : colors.border,
                }}
              />
            ))}
          </View>

          <View style={{ marginTop: space.md, gap: space.sm }}>
            <Button title={last ? "Done" : "Next"} onPress={goNext} />
            <Button title="Skip" variant="softOutline" onPress={() => void finish()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
});
