"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? (theme ?? "system") : "system";
  const label = current[0].toUpperCase() + current.slice(1);

  function cycle() {
    const idx = ORDER.indexOf(current as (typeof ORDER)[number]);
    setTheme(ORDER[(idx + 1) % ORDER.length]);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur transition hover:bg-white/20"
    >
      {label}
    </button>
  );
}
