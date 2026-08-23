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

/** Navy-tinted dark palette — refined further in Phase 14. */
export const darkColors = {
  navy: "#D7E4F0",
  navyDark: "#A8BDD0",
  cream: "#1A2834",
  creamDark: "#141F28",
  amber: "#E8A838",
  amberDark: "#F0C05A",
  text: "#E8EDF2",
  muted: "#9AA8B5",
  border: "#2F4050",
  white: "#243444",
  danger: "#F97066",
  success: "#3DD68C",
  warning: "#F5A524",
  overlay: "rgba(0, 0, 0, 0.4)",
  heroText: "rgba(255,255,255,0.82)",
  bookPlaceholderBg: "#2A3A4A",
  bookPlaceholderIcon: "#8FA3B8",
} as const;

export type ThemeColors = {
  navy: string;
  navyDark: string;
  cream: string;
  creamDark: string;
  amber: string;
  amberDark: string;
  text: string;
  muted: string;
  border: string;
  white: string;
  danger: string;
  success: string;
  warning: string;
  overlay: string;
  heroText: string;
  bookPlaceholderBg: string;
  bookPlaceholderIcon: string;
};
