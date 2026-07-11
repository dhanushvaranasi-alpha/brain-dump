import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";
import type { Task } from "@/lib/tasks";
import { TaskCaptureModal } from "./task-capture-modal";

const CATS: Category[] = [
  { id: "c1", user_id: "u", name: "Home", color: "#6366f1", created_at: "" },
];

function baseProps() {
  return {
    open: true,
    categories: CATS,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCreateCategory: vi.fn(),
  };
}

describe("TaskCaptureModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <TaskCaptureModal {...baseProps()} open={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("submits a new task with a title, due date, and subtasks", async () => {
    const props = baseProps();
    render(<TaskCaptureModal {...props} />);
    await userEvent.type(screen.getByLabelText(/title/i), "Buy milk");
    fireEvent.change(screen.getByLabelText(/due date/i), {
      target: { value: "2026-07-15" },
    });
    await userEvent.type(
      screen.getByPlaceholderText(/add a subtask/i),
      "Get almond",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^add subtask$/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Buy milk",
        due_at: "2026-07-15T00:00:00.000Z",
      }),
      [{ title: "Get almond", is_done: false }],
    );
    expect(props.onClose).toHaveBeenCalled();
  });

  it("pre-fills subtasks in edit mode", () => {
    render(
      <TaskCaptureModal
        {...baseProps()}
        initialSubtasks={[{ id: "s1", title: "Existing sub", is_done: false }]}
      />,
    );
    expect(screen.getByText("Existing sub")).toBeInTheDocument();
  });

  it("pre-fills the form in edit mode", () => {
    const initial: Task = {
      id: "t1",
      user_id: "u",
      title: "Existing",
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
    };
    render(<TaskCaptureModal {...baseProps()} initial={initial} />);
    expect(screen.getByDisplayValue("Existing")).toBeInTheDocument();
    expect(screen.getByText(/edit task/i)).toBeInTheDocument();
  });

  it("disables save when the title is empty", () => {
    render(<TaskCaptureModal {...baseProps()} />);
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });
});
