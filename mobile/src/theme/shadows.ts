import { Platform, type ViewStyle } from "react-native";

export const shadows = {
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#2E4A62",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#2E4A62",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }),
} as const;
