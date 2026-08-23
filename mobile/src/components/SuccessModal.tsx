import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./ui/Button";
import { useTheme } from "../theme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export function SuccessModal({ visible, title, message, onClose }: Props) {
  const { colors, fontFamily, space, type, radius } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: colors.cream, borderRadius: radius.lg },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <Text
            style={{
              fontFamily: fontFamily.display,
              fontSize: type.titleSm,
              color: colors.navy,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
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
            {message}
          </Text>
          <Button title="Done" onPress={onClose} style={{ marginTop: space.lg }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(46, 74, 98, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    padding: 24,
    alignItems: "center",
  },
  iconWrap: {
    marginBottom: 12,
  },
});
