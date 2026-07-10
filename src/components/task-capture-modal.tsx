"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Category } from "@/lib/categories";
import type { Priority, Task, TaskInput } from "@/lib/tasks";
import { CategoryPicker } from "./category-picker";
import { GlassPanel } from "./glass-panel";
import { TagInput } from "./tag-input";

const PRIORITIES: Priority[] = ["none", "low", "med", "high"];

interface TaskCaptureModalProps {
  open: boolean;
  initial?: Task | null;
  categories: Category[];
  onClose: () => void;
  onSubmit: (input: TaskInput) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category>;
}

export function TaskCaptureModal({
  open,
  initial,
  categories,
  onClose,
  onSubmit,
  onCreateCategory,
}: TaskCaptureModalProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    initial?.category_id ?? null,
  );
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [priority, setPriority] = useState<Priority>(
    initial?.priority ?? "none",
  );
  const [dueDate, setDueDate] = useState(initial?.due_at?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const canSave = title.trim().length > 0 && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        tags,
        priority,
        due_at: dueDate ? `${dueDate}T00:00:00.000Z` : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
          <GlassPanel intensity="strong" className="!p-5">
            <h2 className="mb-4 text-lg font-semibold">
              {initial ? "Edit task" : "New task"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-sm font-medium" htmlFor="task-title">
                Title
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />

              <label className="block text-sm font-medium" htmlFor="task-desc">
                Description
              </label>
              <textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />

              <span className="block text-sm font-medium">Category</span>
              <CategoryPicker
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                onCreate={onCreateCategory}
              />

              <span className="block text-sm font-medium">Tags</span>
              <TagInput value={tags} onChange={setTags} />

              <span className="block text-sm font-medium">Priority</span>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-full px-3 py-1 text-sm capitalize transition ${
                      priority === p
                        ? "bg-white/20"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-medium" htmlFor="task-due">
                Due date
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-sm hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSave}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          </GlassPanel>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
