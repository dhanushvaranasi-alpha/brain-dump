"use client";

import type { Category } from "@/lib/categories";
import type { TaskFilter } from "@/lib/task-filter";

interface TaskFilterBarProps {
  categories: Category[];
  allTags: string[];
  value: TaskFilter;
  onChange: (filter: TaskFilter) => void;
}

export function TaskFilterBar({
  categories,
  allTags,
  value,
  onChange,
}: TaskFilterBarProps) {
  if (categories.length === 0 && allTags.length === 0) return null;

  function toggleTag(tag: string) {
    const tags = value.tags.includes(tag)
      ? value.tags.filter((t) => t !== tag)
      : [...value.tags, tag];
    onChange({ ...value, tags });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 backdrop-blur">
      {categories.length > 0 && (
        <select
          aria-label="Filter by category"
          value={value.categoryId ?? ""}
          onChange={(e) =>
            onChange({ ...value, categoryId: e.target.value || null })
          }
          className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {allTags.map((tag) => {
        const active = value.tags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-label={`Filter tag ${tag}`}
            aria-pressed={active}
            onClick={() => toggleTag(tag)}
            className={`rounded-full px-2.5 py-1 text-sm transition ${
              active
                ? "bg-indigo-500/70 text-white"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
