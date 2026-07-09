"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = "Add a tag…",
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const tag = draft.trim();
    setDraft("");
    if (!tag) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 backdrop-blur">
      <AnimatePresence initial={false}>
        {value.map((tag) => (
          <motion.span
            key={tag}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-sm"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => removeTag(tag)}
              className="rounded-full opacity-70 transition hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={placeholder}
        className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none"
      />
    </div>
  );
}
