import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SubtaskItem } from "@/lib/subtasks";
import { SubtaskChecklist } from "./subtask-checklist";

const ITEMS: SubtaskItem[] = [{ id: "s1", title: "Buy milk", is_done: false }];

describe("SubtaskChecklist", () => {
  it("adds a trimmed subtask", async () => {
    const onChange = vi.fn();
    render(<SubtaskChecklist items={[]} onChange={onChange} />);
    await userEvent.type(
      screen.getByPlaceholderText(/add a subtask/i),
      "  Eggs  ",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^add subtask$/i }),
    );
    expect(onChange).toHaveBeenCalledWith([{ title: "Eggs", is_done: false }]);
  });

  it("toggles a subtask's done state", async () => {
    const onChange = vi.fn();
    render(<SubtaskChecklist items={ITEMS} onChange={onChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: /toggle buy milk/i }),
    );
    expect(onChange).toHaveBeenCalledWith([
      { id: "s1", title: "Buy milk", is_done: true },
    ]);
  });

  it("removes a subtask", async () => {
    const onChange = vi.fn();
    render(<SubtaskChecklist items={ITEMS} onChange={onChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: /remove buy milk/i }),
    );
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
