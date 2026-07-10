import { Flag } from "lucide-react";
import type { Priority } from "@/lib/tasks";

const COLORS: Record<Exclude<Priority, "none">, string> = {
  low: "text-slate-400",
  med: "text-amber-400",
  high: "text-red-400",
};

export function PriorityFlag({ priority }: { priority: Priority }) {
  if (priority === "none") return null;
  return (
    <Flag
      aria-label={`Priority: ${priority}`}
      className={`h-3.5 w-3.5 ${COLORS[priority]}`}
    />
  );
}
