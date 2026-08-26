import React, { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
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
    body: "Open the Scan tab at the bottom of the app. Choose Borrow, then point your camera at the QR sticker on a shelf copy. Hold steady until the app confirms the loan.",
  },
  {
    key: "scan-return",
    icon: "return-down-back-outline",
    title: "Return via Scan",
    body: "When you bring a book back, open Scan and switch to Return. Scan the same copy QR. The copy is marked available again and any fine is calculated automatically.",
  },
  {
    key: "reserve",
    icon: "bookmark-outline",
    title: "Reserve when unavailable",
    body: "If every physical copy is checked out, open the title in Catalog and tap Reserve. You join a queue and get a notification when a copy is ready to claim within the hold window.",
  },
  {
    key: "fines",
    icon: "alert-circle-outline",
    title: "Fines block new loans",
    body: "Late returns may add a fine. Unpaid fines block new borrows and reservations until staff clear them at the desk. You can still return books you already have.",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function OnboardingCarousel({ visible, onClose }: Props) {
  const { colors, fontFamily, space, type, radius, mode } = useTheme();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await setOnboardingDone();
    onClose();
  };

  const goNext = () => {
    if (last) {
      void finish();
      return;
    }
    setIndex((i) => i + 1);
  };

  if (!slide) return null;

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
          <View style={styles.content}>
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
              <Ionicons
                name={slide.icon}
                size={36}
                color={mode === "dark" ? colors.amber : colors.navy}
              />
            </View>
            <Text
              style={{
                fontFamily: fontFamily.display,
                fontSize: type.titleSm,
                color: colors.navy,
                textAlign: "center",
              }}
            >
              {slide.title}
            </Text>
            <Text
              style={{
                marginTop: space.sm,
                fontFamily: fontFamily.body,
                fontSize: type.body,
                color: colors.muted,
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              {slide.body}
            </Text>
          </View>

          <View style={styles.dots}>
            {SLIDES.map((item, i) => (
              <View
                key={item.key}
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

          <View style={{ marginTop: space.md, gap: space.sm, width: "100%" }}>
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
    paddingHorizontal: 20,
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  content: {
    width: "100%",
    alignItems: "center",
    minHeight: 200,
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
});
