import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

type ToastPayload = {
  message: string;
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, fontFamily, type, radius, space } = useTheme();
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, durationMs = 3000) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, durationMs });
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          style={[styles.host, { paddingTop: insets.top + 8 }]}
        >
          <View
            style={[
              styles.toast,
              {
                backgroundColor: colors.navy,
                borderRadius: radius.md,
                marginHorizontal: space.md,
              },
            ]}
          >
            <Text
              style={{
                flex: 1,
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.small,
                color: "#F8F7F4",
                lineHeight: 20,
                paddingRight: 8,
              }}
            >
              {toast.message}
            </Text>
            <Pressable
              onPress={dismiss}
              hitSlop={10}
              accessibilityLabel="Dismiss"
              style={styles.close}
            >
              <Ionicons name="close" size={20} color="#F8F7F4" />
            </Pressable>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    alignItems: "stretch",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
