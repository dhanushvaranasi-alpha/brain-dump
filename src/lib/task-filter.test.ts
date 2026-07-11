import { describe, expect, it } from "vitest";
import { filterTasks } from "./task-filter";
import type { Task } from "./tasks";

function task(p: Partial<Task>): Task {
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
    ...p,
  };
}

describe("filterTasks", () => {
  const tasks = [
    task({ id: "a", category_id: "c1", tags: ["work", "urgent"] }),
    task({ id: "b", category_id: "c1", tags: ["work"] }),
    task({ id: "c", category_id: "c2", tags: ["home"] }),
  ];

  it("returns all tasks when the filter is empty", () => {
    const out = filterTasks(tasks, { categoryId: null, tags: [] });
    expect(out.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("filters by category", () => {
    const out = filterTasks(tasks, { categoryId: "c2", tags: [] });
    expect(out.map((t) => t.id)).toEqual(["c"]);
  });

  it("requires all selected tags (AND)", () => {
    const out = filterTasks(tasks, {
      categoryId: null,
      tags: ["work", "urgent"],
    });
    expect(out.map((t) => t.id)).toEqual(["a"]);
  });

  it("combines category and tags", () => {
    const out = filterTasks(tasks, { categoryId: "c1", tags: ["work"] });
    expect(out.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
