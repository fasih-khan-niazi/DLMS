import React, { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Button } from "./ui/Button";
import { useTheme } from "../theme";
import { setOnboardingDone } from "../utils/onboarding";
import { useProfile } from "../context/ProfileContext";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Slide = {
  key: string;
  icon: IoniconName;
  title: string;
  body: string;
};

const STUDENT_SLIDES: Slide[] = [
  {
    key: "scan-borrow",
    icon: "qr-code-outline",
    title: "Borrow Physical Copies",
    body: "Find any book in the library shelves. Open the Scan tab, select 'Borrow', and scan the QR sticker on the book cover to issue it instantly.",
  },
  {
    key: "scan-return",
    icon: "return-down-back-outline",
    title: "Return via Scan",
    body: "When returning a book to the library, switch to 'Return' mode in the Scan tab and scan the copy's QR. The book is checked back in automatically.",
  },
  {
    key: "reserve",
    icon: "bookmark-outline",
    title: "Reserve When All Copies Checked Out",
    body: "If every physical copy is currently issued, you can tap 'Reserve' on the book detail screen to enter the waitlist. You will be notified when your turn arrives.",
  },
  {
    key: "digital-shelf",
    icon: "book-outline",
    title: "Digital Library & In-App Reader",
    body: "Browse digital books in the Catalog, add them to your personal Bookshelf, and read PDFs directly in the app with custom zoom, scroll, and orientation settings.",
  },
  {
    key: "activity-fines",
    icon: "time-outline",
    title: "Track Loans, Reservations & Fines",
    body: "Use the Activity tab to monitor due dates for active loans, check queue position for reservations, view your return history, and track any outstanding fines.",
  },
];

const STAFF_SLIDES: Slide[] = [
  {
    key: "staff-catalog",
    icon: "library-outline",
    title: "Catalog & Copy Management",
    body: "Explore all physical and digital library inventory. Staff can view copy-level statuses, copy numbers, and access QR labels for physical printing.",
  },
  {
    key: "staff-scan",
    icon: "qr-code-outline",
    title: "Desk Checkout & Returns",
    body: "Scan shelf QR codes on behalf of patrons or for your own loans (when borrowing is enabled). Returns instantly update book availability across the catalog.",
  },
  {
    key: "staff-digital",
    icon: "cloud-upload-outline",
    title: "Digital PDF Library Management",
    body: "Manage e-books, lecture notes, and digital study materials. Upload PDF files with category tags, custom covers, and author metadata.",
  },
  {
    key: "staff-policy",
    icon: "shield-checkmark-outline",
    title: "System Rules & Borrowing Control",
    body: "Loan limits, fine rules, reservation hold windows, and librarian borrowing permissions are configured centrally via the Admin Portal.",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function OnboardingCarousel({ visible, onClose }: Props) {
  const { colors, fontFamily, space, type, radius, mode } = useTheme();
  const { profile, isStaff } = useProfile();
  const [index, setIndex] = useState(0);

  const slides = isStaff ? STAFF_SLIDES : STUDENT_SLIDES;

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const slide = slides[index] || slides[0];
  const last = index === slides.length - 1;

  const finish = async () => {
    await setOnboardingDone(profile?.uid);
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
            {slides.map((item, i) => (
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
            {!last ? (
              <Button title="Skip" variant="softOutline" onPress={() => void finish()} />
            ) : null}
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
