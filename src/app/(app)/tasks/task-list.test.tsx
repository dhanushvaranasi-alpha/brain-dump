import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";
import type { Task } from "@/lib/tasks";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const Tag = tag as keyof React.JSX.IntrinsicElements;
        return ({
          children,
          layout: _l,
          initial: _i,
          animate: _a,
          exit: _e,
          whileHover: _wh,
          whileTap: _wt,
          ...rest
        }: Record<string, unknown> & { children?: React.ReactNode }) => (
          <Tag {...rest}>{children}</Tag>
        );
      },
    },
  ),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const createTask = vi.fn();
const updateTask = vi.fn();
const toggleComplete = vi.fn();
const deleteTask = vi.fn();
vi.mock("@/lib/tasks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tasks")>();
  return {
    ...actual,
    createTask: (...a: unknown[]) => createTask(...a),
    updateTask: (...a: unknown[]) => updateTask(...a),
    toggleComplete: (...a: unknown[]) => toggleComplete(...a),
    deleteTask: (...a: unknown[]) => deleteTask(...a),
  };
});
vi.mock("@/lib/categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/categories")>();
  return { ...actual, createCategory: vi.fn() };
});

import { TaskList } from "./task-list";

const CATS: Category[] = [
  { id: "c1", user_id: "u", name: "Home", color: "#6366f1", created_at: "" },
];
function task(p: Partial<Task>): Task {
  return {
    id: "t1",
    user_id: "u",
    title: "Buy milk",
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

beforeEach(() => {
  createTask.mockReset();
  updateTask.mockReset();
  toggleComplete.mockReset();
  deleteTask.mockReset();
});

describe("TaskList", () => {
  it("renders existing tasks grouped", () => {
    render(<TaskList initialTasks={[task({})]} categories={CATS} />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
  });

  it("shows an empty state when there are no tasks", () => {
    render(<TaskList initialTasks={[]} categories={CATS} />);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it("optimistically moves a task to completed on toggle", async () => {
    toggleComplete.mockResolvedValue(task({ status: "done" }));
    render(<TaskList initialTasks={[task({})]} categories={CATS} />);
    await userEvent.click(
      screen.getByRole("button", { name: /complete buy milk/i }),
    );
    expect(toggleComplete).toHaveBeenCalledWith(expect.anything(), "t1", true);
  });

  it("opens the edit modal pre-filled when a task is clicked", async () => {
    render(<TaskList initialTasks={[task({})]} categories={CATS} />);
    await userEvent.click(
      screen.getByRole("button", { name: /edit buy milk/i }),
    );
    expect(screen.getByDisplayValue("Buy milk")).toBeInTheDocument();
  });

  it("shows a subtask progress badge on a task's card", () => {
    render(
      <TaskList
        initialTasks={[task({ id: "t1" })]}
        categories={CATS}
        initialSubtasks={[
          {
            id: "s1",
            task_id: "t1",
            title: "sub",
            is_done: true,
            position: 0,
            created_at: "",
          },
          {
            id: "s2",
            task_id: "t1",
            title: "sub2",
            is_done: false,
            position: 1,
            created_at: "",
          },
        ]}
      />,
    );
    expect(screen.getByLabelText(/1 of 2 subtasks done/i)).toBeInTheDocument();
  });

  it("filters the list by tag", async () => {
    render(
      <TaskList
        initialTasks={[
          task({ id: "t1", title: "Work task", tags: ["work"] }),
          task({ id: "t2", title: "Home task", tags: ["home"] }),
        ]}
        categories={CATS}
      />,
    );
    expect(screen.getByText("Home task")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /filter tag work/i }),
    );
    expect(screen.queryByText("Home task")).not.toBeInTheDocument();
    expect(screen.getByText("Work task")).toBeInTheDocument();
  });
});
