import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";
import type { TaskFilter } from "@/lib/task-filter";
import { TaskFilterBar } from "./task-filter-bar";

const CATS: Category[] = [
  { id: "c1", user_id: "u", name: "Work", color: "#6366f1", created_at: "" },
];
const EMPTY: TaskFilter = { categoryId: null, tags: [] };

describe("TaskFilterBar", () => {
  it("selects a category", async () => {
    const onChange = vi.fn();
    render(
      <TaskFilterBar
        categories={CATS}
        allTags={["work"]}
        value={EMPTY}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /filter by category/i }),
      "c1",
    );
    expect(onChange).toHaveBeenCalledWith({ categoryId: "c1", tags: [] });
  });

  it("toggles a tag on", async () => {
    const onChange = vi.fn();
    render(
      <TaskFilterBar
        categories={CATS}
        allTags={["work"]}
        value={EMPTY}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter tag work/i }),
    );
    expect(onChange).toHaveBeenCalledWith({ categoryId: null, tags: ["work"] });
  });

  it("renders nothing when there is nothing to filter", () => {
    const { container } = render(
      <TaskFilterBar
        categories={[]}
        allTags={[]}
        value={EMPTY}
        onChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
