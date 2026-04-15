export type Theme = "dark" | "light";

export const THEME_KEY = "arma-admin-theme";

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // Admin tool defaults to dark mode; user can switch via the theme toggle
  return "dark";
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