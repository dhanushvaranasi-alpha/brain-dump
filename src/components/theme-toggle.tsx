"use client";

import { motion } from "framer-motion";
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
    <motion.button
      type="button"
      onClick={() => setTheme(currentTheme === "light" ? "dark" : "light")}
      aria-label={`Theme: ${currentTheme}. Click to change.`}
      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur transition hover:bg-white/20 dark:border-white/10 dark:bg-white/5"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <motion.div
        initial={{ rotate: 0, opacity: 1 }}
        animate={{ rotate: currentTheme === "dark" ? 180 : 0, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
      >
        <Icon className="h-4 w-4" />
      </motion.div>
    </motion.button>
  );
}
