const THEME_KEY = "dlms.admin.theme";

export type ThemeMode = "light" | "dark";

export function getStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // ignore
  }
}

export function toggleStoredTheme(): ThemeMode {
  const next: ThemeMode = getStoredTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
