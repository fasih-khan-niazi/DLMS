import { lightColors, type ThemeColors } from "./colors";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { space } from "./spacing";
import { fontFamily, type } from "./typography";

export type AppTheme = {
  mode: "light" | "dark";
  colors: ThemeColors;
  space: typeof space;
  radius: typeof radius;
  shadows: typeof shadows;
  fontFamily: typeof fontFamily;
  type: typeof type;
};

export const lightTheme: AppTheme = {
  mode: "light",
  colors: lightColors,
  space,
  radius,
  shadows,
  fontFamily,
  type,
};
