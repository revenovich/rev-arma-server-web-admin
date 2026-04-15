import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "@/hooks/useTheme";
import { getTheme, setTheme, THEME_KEY } from "@/lib/theme";

describe("theme lib", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.removeAttribute("class");
  });

  describe("getTheme", () => {
    it("returns 'dark' when no stored preference", () => {
      // Dark is the default — no class needed
      expect(getTheme()).toBe("dark");
    });

    it("returns stored preference when available", () => {
      localStorage.setItem(THEME_KEY, "light");
      expect(getTheme()).toBe("light");
    });

    it("returns 'dark' by default regardless of system preference", () => {
      // This admin tool defaults to dark — system preference is not checked
      expect(getTheme()).toBe("dark");
    });
  });

  describe("setTheme", () => {
    it("stores theme in localStorage", () => {
      setTheme("light");
      expect(localStorage.getItem(THEME_KEY)).toBe("light");
    });

    it("adds 'light' class to documentElement for light theme", () => {
      setTheme("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });

    it("removes 'light' class for dark theme (dark is the default)", () => {
      setTheme("light");
      setTheme("dark");
      expect(document.documentElement.classList.contains("light")).toBe(false);
    });

    it("removes previous theme class when switching", () => {
      setTheme("light");
      setTheme("dark");
      expect(document.documentElement.classList.contains("light")).toBe(false);
    });
  });
});

describe("useTheme hook", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark", "light");
  });

  it("returns current theme", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("toggles theme from dark to light", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("toggles theme from light to dark", () => {
    localStorage.setItem(THEME_KEY, "light");
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});