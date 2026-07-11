import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/tasks";
import { TaskCard } from "./task-card";

function task(p: Partial<Task>): Task {
  return {
    id: "t1",
    user_id: "u",
    title: "Buy milk",
    description: null,
    category_id: null,
    tags: [],
    priority: "high",
    due_at: "2026-07-15T00:00:00.000Z",
    status: "todo",
    recurrence: null,
    completed_at: null,
    created_at: "",
    updated_at: "",
    ...p,
  };
}

describe("TaskCard", () => {
  it("shows the title, priority, and due date", () => {
    render(<TaskCard task={task({})} onToggle={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByLabelText(/priority: high/i)).toBeInTheDocument();
    expect(screen.getByText("2026-07-15")).toBeInTheDocument();
  });

  it("toggles completion when the checkbox is clicked", async () => {
    const onToggle = vi.fn();
    render(<TaskCard task={task({})} onToggle={onToggle} onEdit={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: /complete buy milk/i }),
    );
    expect(onToggle).toHaveBeenCalled();
  });

  it("requests edit when the title is clicked", async () => {
    const onEdit = vi.fn();
    render(<TaskCard task={task({})} onToggle={vi.fn()} onEdit={onEdit} />);
    await userEvent.click(
      screen.getByRole("button", { name: /edit buy milk/i }),
    );
    expect(onEdit).toHaveBeenCalled();
  });

  it("shows a subtask progress badge when the task has subtasks", () => {
    render(
      <TaskCard
        task={task({})}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        subtaskDone={2}
        subtaskTotal={5}
      />,
    );
    expect(screen.getByLabelText(/2 of 5 subtasks done/i)).toHaveTextContent(
      "2/5",
    );
  });
});
