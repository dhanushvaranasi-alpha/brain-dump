"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { Category } from "@/lib/categories";

interface CategoryPickerProps {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate: (name: string) => Promise<Category>;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  onCreate,
}: CategoryPickerProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const trimmed = query.trim();
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const exactExists = categories.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = trimmed.length > 0 && !exactExists;

  async function handleCreate() {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(trimmed);
      onChange(created.id);
      setQuery("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search or create a category…"
        className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full px-3 py-1 text-sm transition ${
            value === null ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
          }`}
        >
          None
        </button>
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition ${
              value === c.id ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            {c.name}
          </button>
        ))}
        {canCreate && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500/80 to-purple-500/80 px-3 py-1 text-sm text-white transition hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Create "{trimmed}"
          </button>
        )}
      </div>
    </div>
  );
}
