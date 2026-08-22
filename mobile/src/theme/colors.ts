export const lightColors = {
  navy: "#2E4A62",
  navyDark: "#243A4E",
  cream: "#F8F7F4",
  creamDark: "#EBE8E1",
  amber: "#E8A838",
  amberDark: "#C98B1E",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#E5E1D8",
  white: "#FFFFFF",
  danger: "#B42318",
  success: "#1F6B3A",
  warning: "#B45309",
  overlay: "rgba(46, 74, 98, 0.08)",
  heroText: "rgba(255,255,255,0.82)",
  bookPlaceholderBg: "#E8EDF2",
  bookPlaceholderIcon: "#8FA3B8",
} as const;

export type ThemeColors = typeof lightColors;
