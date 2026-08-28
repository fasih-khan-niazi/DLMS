import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Button } from "./ui/Button";
import { useTheme } from "../theme";
import { formatShortDate } from "../utils/loanDates";

export type ScanResult =
  | {
      kind: "success";
      title: string;
      message: string;
      dueDate?: unknown;
      mode: "borrow" | "return";
      isLastReturnForLibrarian?: boolean;
    }
  | {
      kind: "error";
      message: string;
      mode: "borrow" | "return";
    };

type Props = {
  result: ScanResult | null;
  onDismiss: () => void;
  onRetry?: () => void;
  onGoHome?: () => void;
};

export function ScanResultSheet({ result, onDismiss, onRetry, onGoHome }: Props) {
  const { colors, fontFamily, space, type, radius } = useTheme();

  if (!result) return null;

  const success = result.kind === "success";

  const onBackdropPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.cream,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
            },
          ]}
        >
          <View style={styles.iconRow}>
            <Ionicons
              name={success ? "checkmark-circle" : "alert-circle"}
              size={48}
              color={success ? colors.success : colors.danger}
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
            {success ? (result.mode === "borrow" ? "Borrowed" : "Returned") : "Scan failed"}
          </Text>

          {success && result.title ? (
            <Text
              style={{
                marginTop: space.sm,
                fontFamily: fontFamily.bodyBold,
                fontSize: type.body,
                color: colors.navy,
                textAlign: "center",
              }}
            >
              {result.title}
            </Text>
          ) : null}

          <Text
            style={{
              marginTop: space.sm,
              fontFamily: fontFamily.body,
              fontSize: type.small,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            {result.message}
          </Text>

          {success && result.dueDate ? (
            <Text
              style={{
                marginTop: space.xs,
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.small,
                color: colors.text,
                textAlign: "center",
              }}
            >
              Due {formatShortDate(result.dueDate)}
            </Text>
          ) : null}

          <View style={{ marginTop: space.lg, gap: space.sm }}>
            {result.kind === "error" && onRetry ? (
              <Button title="Try again" onPress={onRetry} />
            ) : result.kind === "success" && result.isLastReturnForLibrarian && onGoHome ? (
              <Button title="Go to Home" onPress={onGoHome} />
            ) : (
              <Button title="Done" onPress={onDismiss} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(46, 74, 98, 0.45)",
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  iconRow: {
    alignItems: "center",
    marginBottom: 8,
  },
});
