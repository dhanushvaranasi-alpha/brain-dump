"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TaskCaptureModal } from "@/components/task-capture-modal";
import { TaskCard } from "@/components/task-card";
import { TaskFilterBar } from "@/components/task-filter-bar";
import { type Category, createCategory } from "@/lib/categories";
import {
  createSubtask,
  deleteSubtask,
  diffSubtasks,
  type Subtask,
  type SubtaskItem,
  toggleSubtask,
} from "@/lib/subtasks";
import { createClient } from "@/lib/supabase/client";
import { filterTasks, type TaskFilter } from "@/lib/task-filter";
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

const EMPTY_FILTER: TaskFilter = { categoryId: null, tags: [] };

export function TaskList({
  initialTasks,
  categories,
  initialSubtasks = [],
}: {
  initialTasks: Task[];
  categories: Category[];
  initialSubtasks?: Subtask[];
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks);
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const groups = groupTasks(filterTasks(tasks, filter), todayKey());
  const allTags = [...new Set(tasks.flatMap((t) => t.tags))].sort();

  function subtasksFor(taskId: string): Subtask[] {
    return subtasks.filter((s) => s.task_id === taskId);
  }

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(task: Task) {
    setEditing(task);
    setModalOpen(true);
  }

  async function persistSubtasks(taskId: string, submitted: SubtaskItem[]) {
    const original = subtasksFor(taskId);
    const { toCreate, toToggle, toDelete } = diffSubtasks(original, submitted);
    const created = await Promise.all(
      toCreate.map((s) =>
        createSubtask(supabase, {
          task_id: taskId,
          title: s.title,
          position: s.position,
        }),
      ),
    );
    await Promise.all(
      toToggle.map((s) => toggleSubtask(supabase, s.id, s.is_done)),
    );
    await Promise.all(toDelete.map((id) => deleteSubtask(supabase, id)));
    setSubtasks((prev) => {
      const kept = prev.filter(
        (s) => s.task_id !== taskId || !toDelete.includes(s.id),
      );
      const toggled = kept.map((s) => {
        const t = toToggle.find((x) => x.id === s.id);
        return t ? { ...s, is_done: t.is_done } : s;
      });
      return [...toggled, ...created];
    });
  }

  async function handleSubmit(
    input: TaskInput,
    submittedSubtasks: SubtaskItem[],
  ) {
    if (editing) {
      const prev = tasks;
      const target = editing;
      setTasks((ts) =>
        ts.map((t) => (t.id === target.id ? { ...t, ...input } : t)),
      );
      try {
        const saved = await updateTask(supabase, target.id, input);
        setTasks((ts) => ts.map((t) => (t.id === saved.id ? saved : t)));
        await persistSubtasks(target.id, submittedSubtasks);
      } catch {
        setTasks(prev);
        toast.error("Could not save task");
      }
    } else {
      try {
        const created = await createTask(supabase, input);
        setTasks((ts) => [created, ...ts]);
        await persistSubtasks(created.id, submittedSubtasks);
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

  const editingSubtasks: SubtaskItem[] = editing
    ? subtasksFor(editing.id).map((s) => ({
        id: s.id,
        title: s.title,
        is_done: s.is_done,
      }))
    : [];

  return (
    <div className="space-y-4">
      <TaskFilterBar
        categories={categories}
        allTags={allTags}
        value={filter}
        onChange={setFilter}
      />

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
                    {groupTasksList.map((task) => {
                      const subs = subtasksFor(task.id);
                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={handleToggle}
                          onEdit={openEdit}
                          subtaskDone={subs.filter((s) => s.is_done).length}
                          subtaskTotal={subs.length}
                        />
                      );
                    })}
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
          initialSubtasks={editingSubtasks}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          onCreateCategory={handleCreateCategory}
        />
      )}
    </div>
  );
}
