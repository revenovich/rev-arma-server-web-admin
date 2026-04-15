export type Theme = "dark" | "light";

export const THEME_KEY = "arma-admin-theme";

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  // Dark is the CSS default — no class needed.
  // Light mode requires the .light class to be present.
  if (theme === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
}

export function toggleThemeValue(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}
