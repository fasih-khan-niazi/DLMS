/**
 * Shared visual tokens for DLMS mobile (Block A).
 * Keep screens importing from here instead of hardcoding one-offs.
 */
export const colors = {
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
  overlay: "rgba(46, 74, 98, 0.08)",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  brand: 40,
  title: 28,
  subtitle: 15,
  body: 16,
  small: 13,
} as const;
