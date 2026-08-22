import { lightColors } from "./colors";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { space } from "./spacing";
import { fontFamily, type } from "./typography";

export const lightTheme = {
  mode: "light" as const,
  colors: lightColors,
  space,
  radius,
  shadows,
  fontFamily,
  type,
};

export type AppTheme = typeof lightTheme;
