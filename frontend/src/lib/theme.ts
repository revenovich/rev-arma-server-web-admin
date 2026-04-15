export type Theme = "dark" | "light";

export const THEME_KEY = "arma-admin-theme";

function getSystemPreference(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return getSystemPreference();
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
}

export function toggleThemeValue(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}