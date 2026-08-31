import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

type ToastPayload = {
  message: string;
  durationMs: number;
  key: number;
};

type ToastContextValue = {
  showToast: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { fontFamily, type, radius, mode } = useTheme();
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useRef(new Animated.Value(1)).current;
  const toastKey = useRef(0);

  const isDark = mode === "dark";
  const toastBg = isDark ? "#3A2424" : "#FEE4E2";
  const toastBorder = isDark ? "#5C3030" : "#FECACA";
  const toastText = isDark ? "#FECACA" : "#B42318";
  const progressTrack = isDark ? "rgba(255,255,255,0.12)" : "rgba(180,35,24,0.15)";
  const progressFill = isDark ? "#FECACA" : "#B42318";

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    progress.stopAnimation();
    setToast(null);
  }, [progress]);

  const showToast = useCallback(
    (message: string, durationMs = 3000) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      toastKey.current += 1;
      const key = toastKey.current;

      progress.stopAnimation();
      progress.setValue(1);

      setToast({ message, durationMs, key });

      Animated.timing(progress, {
        toValue: 0,
        duration: durationMs,
        useNativeDriver: false,
      }).start();

      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    [progress]
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + 10 }]}>
          <View
            style={[
              styles.toast,
              {
                backgroundColor: toastBg,
                borderColor: toastBorder,
                borderRadius: radius.lg,
                maxWidth: 340,
              },
            ]}
          >
            <Text
              style={{
                flex: 1,
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.caption,
                color: toastText,
                lineHeight: 18,
                textAlign: "center",
                paddingHorizontal: 4,
              }}
              numberOfLines={3}
            >
              {toast.message}
            </Text>
            <Pressable
              onPress={dismiss}
              hitSlop={8}
              accessibilityLabel="Dismiss"
              style={[
                styles.closeCircle,
                { borderColor: toastBorder, backgroundColor: isDark ? "#4A2E2E" : "#FFF5F5" },
              ]}
            >
              <Ionicons name="close" size={14} color={toastText} />
            </Pressable>
            <View style={[styles.progressTrack, { backgroundColor: progressTrack }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: progressFill, width: barWidth },
                ]}
              />
            </View>
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
    alignItems: "center",
    pointerEvents: "box-none",
  },
  toast: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: "hidden",
  },
  closeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  progressFill: {
    height: 3,
  },
});
