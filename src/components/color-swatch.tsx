"use client";

import { motion } from "framer-motion";

interface ColorSwatchProps {
  color: string;
  selected: boolean;
  onSelect: (color: string) => void;
}

export function ColorSwatch({ color, selected, onSelect }: ColorSwatchProps) {
  return (
    <motion.button
      type="button"
      aria-label={`Color ${color}`}
      aria-pressed={selected}
      onClick={() => onSelect(color)}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      style={{ backgroundColor: color }}
      className={`h-6 w-6 rounded-full transition-shadow ${
        selected
          ? "ring-2 ring-white ring-offset-2 ring-offset-transparent shadow-lg"
          : "opacity-80 hover:opacity-100"
      }`}
    />
  );
}
