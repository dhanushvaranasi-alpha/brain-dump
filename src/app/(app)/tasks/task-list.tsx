"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TaskCaptureModal } from "@/components/task-capture-modal";
import { TaskCard } from "@/components/task-card";
import { type Category, createCategory } from "@/lib/categories";
import { createClient } from "@/lib/supabase/client";
import { GROUP_LABELS, GROUP_ORDER, groupTasks } from "@/lib/task-groups";
import {
  createTask,
  type Task,
  type TaskInput,
  toggleComplete,
  updateTask,
} from "@/lib/tasks";

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)
}

export function TaskList({
  initialTasks,
  categories,
}: {
  initialTasks: Task[];
  categories: Category[];
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const groups = groupTasks(tasks, todayKey());

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(task: Task) {
    setEditing(task);
    setModalOpen(true);
  }

  async function handleSubmit(input: TaskInput) {
    if (editing) {
      const prev = tasks;
      const target = editing;
      setTasks((ts) =>
        ts.map((t) => (t.id === target.id ? { ...t, ...input } : t)),
      );
      try {
        const saved = await updateTask(supabase, target.id, input);
        setTasks((ts) => ts.map((t) => (t.id === saved.id ? saved : t)));
      } catch {
        setTasks(prev);
        toast.error("Could not save task");
      }
    } else {
      try {
        const created = await createTask(supabase, input);
        setTasks((ts) => [created, ...ts]);
      } catch {
        toast.error("Could not add task");
      }
    }
  }

  async function handleToggle(task: Task) {
    const done = task.status !== "done";
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) =>
        t.id === task.id ? { ...t, status: done ? "done" : "todo" } : t,
      ),
    );
    try {
      const saved = await toggleComplete(supabase, task.id, done);
      setTasks((ts) => ts.map((t) => (t.id === saved.id ? saved : t)));
    } catch {
      setTasks(prev);
      toast.error("Could not update task");
    }
  }

  async function handleCreateCategory(name: string) {
    return createCategory(supabase, { name, color: "#6366f1" });
  }

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Tap the + button to capture your first task."
        />
      ) : (
        <div className="space-y-5">
          {GROUP_ORDER.map((key) => {
            const groupTasksList = groups[key];
            if (groupTasksList.length === 0) return null;
            return (
              <section key={key}>
                <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide opacity-60">
                  {GROUP_LABELS[key]}
                </h2>
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {groupTasksList.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={handleToggle}
                        onEdit={openEdit}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <motion.button
        type="button"
        aria-label="New task"
        onClick={openNew}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-xl shadow-indigo-500/30"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      {modalOpen && (
        <TaskCaptureModal
          key={editing?.id ?? "new"}
          open
          initial={editing}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          onCreateCategory={handleCreateCategory}
        />
      )}
    </div>
  );
}
