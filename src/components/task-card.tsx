"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { Task } from "@/lib/tasks";
import { PriorityFlag } from "./priority-flag";

interface TaskCardProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
}

export function TaskCard({ task, onToggle, onEdit }: TaskCardProps) {
  const done = task.status === "done";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-2xl"
    >
      <motion.button
        type="button"
        aria-label={`${done ? "Mark incomplete" : "Complete"} ${task.title}`}
        onClick={() => onToggle(task)}
        whileTap={{ scale: 0.8 }}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
          done
            ? "border-emerald-400 bg-emerald-500/80 text-white"
            : "border-white/40 hover:border-white/70"
        }`}
      >
        {done && <Check className="h-3.5 w-3.5" />}
      </motion.button>
      <button
        type="button"
        aria-label={`Edit ${task.title}`}
        onClick={() => onEdit(task)}
        className="flex flex-1 items-center gap-2 text-left"
      >
        <span
          className={`flex-1 text-sm ${done ? "line-through opacity-60" : ""}`}
        >
          {task.title}
        </span>
        <PriorityFlag priority={task.priority} />
        {task.due_at && (
          <span className="text-xs opacity-70">{task.due_at.slice(0, 10)}</span>
        )}
      </button>
    </motion.li>
  );
}
