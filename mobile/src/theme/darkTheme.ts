import { darkColors } from "./colors";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { space } from "./spacing";
import { fontFamily, type } from "./typography";
import type { AppTheme } from "./lightTheme";

export const darkTheme: AppTheme = {
  mode: "dark",
  colors: darkColors,
  space,
  radius,
  shadows,
  fontFamily,
  type,
};
