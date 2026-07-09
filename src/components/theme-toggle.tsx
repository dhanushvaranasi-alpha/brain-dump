"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      setCurrentTheme(systemTheme);
    } else {
      setCurrentTheme(theme as "light" | "dark");
    }
  }, [theme]);

  function toggle() {
    setTheme(currentTheme === "light" ? "dark" : "light");
  }

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur opacity-50"
      >
        <Moon className="h-4 w-4" />
      </button>
    );
  }

  const Icon = currentTheme === "light" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Theme: ${currentTheme}. Click to change.`}
      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur transition hover:bg-white/20 dark:border-white/10 dark:bg-white/5"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
