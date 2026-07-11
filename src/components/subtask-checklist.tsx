"use client";

import { Check, Plus, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import type { SubtaskItem } from "@/lib/subtasks";

interface SubtaskChecklistProps {
  items: SubtaskItem[];
  onChange: (items: SubtaskItem[]) => void;
}

export function SubtaskChecklist({ items, onChange }: SubtaskChecklistProps) {
  const [draft, setDraft] = useState("");

  function add() {
    const title = draft.trim();
    setDraft("");
    if (!title) return;
    onChange([...items, { title, is_done: false }]);
  }

  function toggle(index: number) {
    onChange(
      items.map((s, i) => (i === index ? { ...s, is_done: !s.is_done } : s)),
    );
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li
            key={item.id ?? `new-${index}`}
            className="flex items-center gap-2 text-sm"
          >
            <button
              type="button"
              aria-label={`Toggle ${item.title}`}
              onClick={() => toggle(index)}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                item.is_done
                  ? "border-emerald-400 bg-emerald-500/80 text-white"
                  : "border-white/40 hover:border-white/70"
              }`}
            >
              {item.is_done && <Check className="h-3 w-3" />}
            </button>
            <span
              className={`flex-1 ${item.is_done ? "line-through opacity-60" : ""}`}
            >
              {item.title}
            </span>
            <button
              type="button"
              aria-label={`Remove ${item.title}`}
              onClick={() => remove(index)}
              className="rounded opacity-70 transition hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a subtask…"
          className="flex-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="button"
          aria-label="Add subtask"
          onClick={add}
          className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-sm hover:bg-white/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
