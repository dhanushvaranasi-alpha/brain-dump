import type { Task } from "./tasks";

export interface TaskFilter {
  categoryId: string | null;
  tags: string[];
}

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  return tasks.filter((task) => {
    if (filter.categoryId && task.category_id !== filter.categoryId) {
      return false;
    }
    return filter.tags.every((tag) => task.tags.includes(tag));
  });
}
