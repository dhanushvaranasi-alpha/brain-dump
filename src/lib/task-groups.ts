import type { Task } from "./tasks";

export interface GroupedTasks {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  noDate: Task[];
  completed: Task[];
}

export const GROUP_ORDER: (keyof GroupedTasks)[] = [
  "overdue",
  "today",
  "upcoming",
  "noDate",
  "completed",
];

export const GROUP_LABELS: Record<keyof GroupedTasks, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  noDate: "No date",
  completed: "Completed",
};

// `todayKey` is the local calendar date as "YYYY-MM-DD".
export function groupTasks(tasks: Task[], todayKey: string): GroupedTasks {
  const groups: GroupedTasks = {
    overdue: [],
    today: [],
    upcoming: [],
    noDate: [],
    completed: [],
  };
  for (const task of tasks) {
    if (task.status === "done") {
      groups.completed.push(task);
    } else if (!task.due_at) {
      groups.noDate.push(task);
    } else {
      const dueKey = task.due_at.slice(0, 10);
      if (dueKey < todayKey) groups.overdue.push(task);
      else if (dueKey === todayKey) groups.today.push(task);
      else groups.upcoming.push(task);
    }
  }
  return groups;
}
