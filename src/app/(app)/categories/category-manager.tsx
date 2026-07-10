"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ColorSwatch } from "@/components/color-swatch";
import { GlassPanel } from "@/components/glass-panel";
import {
  type Category,
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/categories";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from "@/lib/category-colors";
import { createClient } from "@/lib/supabase/client";

export function CategoryManager({ initial }: { initial: Category[] }) {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>(initial);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState<string>(DEFAULT_CATEGORY_COLOR);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    setDraftName("");
    try {
      const created = await createCategory(supabase, {
        name,
        color: draftColor,
      });
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setDraftColor(DEFAULT_CATEGORY_COLOR);
    } catch {
      toast.error("Could not add category");
    }
  }

  async function handleRename(cat: Category, name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === cat.name) return;
    const prev = categories;
    setCategories((cs) =>
      cs.map((c) => (c.id === cat.id ? { ...c, name: trimmed } : c)),
    );
    try {
      await updateCategory(supabase, cat.id, { name: trimmed });
    } catch {
      setCategories(prev);
      toast.error("Could not rename category");
    }
  }

  async function handleRecolor(cat: Category, color: string) {
    const prev = categories;
    setCategories((cs) =>
      cs.map((c) => (c.id === cat.id ? { ...c, color } : c)),
    );
    try {
      await updateCategory(supabase, cat.id, { color });
    } catch {
      setCategories(prev);
      toast.error("Could not update color");
    }
  }

  async function handleDelete(cat: Category) {
    const prev = categories;
    setCategories((cs) => cs.filter((c) => c.id !== cat.id));
    try {
      await deleteCategory(supabase, cat.id);
    } catch {
      setCategories(prev);
      toast.error("Could not delete category");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-lg font-semibold tracking-tight">Categories</h1>

      <GlassPanel intensity="medium" className="!p-4">
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-center gap-3"
        >
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="New category…"
            className="min-w-[10rem] flex-1 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex items-center gap-1.5">
            {CATEGORY_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                selected={draftColor === color}
                onSelect={setDraftColor}
              />
            ))}
          </div>
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-600 hover:to-purple-600"
          >
            Add
          </button>
        </form>
      </GlassPanel>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {categories.map((cat) => (
            <motion.li
              key={cat.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-2xl"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <input
                type="text"
                defaultValue={cat.name}
                aria-label={`Rename ${cat.name}`}
                onBlur={(e) => handleRename(cat, e.target.value)}
                className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none focus:underline"
              />
              <div className="flex items-center gap-1.5">
                {CATEGORY_COLORS.map((color) => (
                  <ColorSwatch
                    key={color}
                    color={color}
                    selected={cat.color === color}
                    onSelect={(c) => handleRecolor(cat, c)}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label={`Delete ${cat.name}`}
                onClick={() => handleDelete(cat)}
                className="rounded-lg p-1.5 opacity-70 transition hover:bg-red-500/20 hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {categories.length === 0 && (
        <p className="px-1 text-sm opacity-70">
          No categories yet. Add your first one above.
        </p>
      )}
    </div>
  );
}
