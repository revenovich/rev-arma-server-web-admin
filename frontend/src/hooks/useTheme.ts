import { useState, useCallback, useEffect } from "react";
import {
  getTheme,
  setTheme as applyTheme,
  toggleThemeValue,
  type Theme,
} from "@/lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = getTheme();
    applyTheme(initial);
    return initial;
  });

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = toggleThemeValue(prev);
      applyTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, toggleTheme } as const;
}