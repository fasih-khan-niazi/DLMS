export { lightTheme, type AppTheme } from "./lightTheme";
export { darkTheme } from "./darkTheme";
export { lightColors, darkColors, type ThemeColors } from "./colors";
export { space } from "./spacing";
export { radius } from "./radius";
export { shadows } from "./shadows";
export { fontFamily, type as typeScale } from "./typography";
export { ThemeProvider, useTheme } from "./ThemeProvider";

// purane screens ke liye flat light-theme exports
import { lightTheme } from "./lightTheme";

export const colors = lightTheme.colors;
export const type = lightTheme.type;
