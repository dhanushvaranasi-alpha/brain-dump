import { describe, expect, it } from "vitest";
import { GROUP_ORDER, groupTasks } from "./task-groups";
import type { Task } from "./tasks";

function task(partial: Partial<Task>): Task {
  return {
    id: "t",
    user_id: "u",
    title: "T",
    description: null,
    category_id: null,
    tags: [],
    priority: "none",
    due_at: null,
    status: "todo",
    recurrence: null,
    completed_at: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("groupTasks", () => {
  const today = "2026-07-10";

  it("buckets by due date relative to today", () => {
    const tasks = [
      task({ id: "past", due_at: "2026-07-01T00:00:00.000Z" }),
      task({ id: "now", due_at: "2026-07-10T00:00:00.000Z" }),
      task({ id: "future", due_at: "2026-07-20T00:00:00.000Z" }),
      task({ id: "none" }),
    ];
    const g = groupTasks(tasks, today);
    expect(g.overdue.map((t) => t.id)).toEqual(["past"]);
    expect(g.today.map((t) => t.id)).toEqual(["now"]);
    expect(g.upcoming.map((t) => t.id)).toEqual(["future"]);
    expect(g.noDate.map((t) => t.id)).toEqual(["none"]);
  });

  it("puts done tasks in completed regardless of due date", () => {
    const tasks = [
      task({ id: "d", status: "done", due_at: "2026-07-01T00:00:00.000Z" }),
    ];
    const g = groupTasks(tasks, today);
    expect(g.completed.map((t) => t.id)).toEqual(["d"]);
    expect(g.overdue).toEqual([]);
  });

  it("exposes a stable group order", () => {
    expect(GROUP_ORDER).toEqual([
      "overdue",
      "today",
      "upcoming",
      "noDate",
      "completed",
    ]);
  });
});
