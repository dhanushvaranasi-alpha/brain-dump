import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";
import { CategoryPicker } from "./category-picker";

const CATS: Category[] = [
  {
    id: "c1",
    user_id: "u1",
    name: "Work",
    color: "#6366f1",
    created_at: "",
  },
];

describe("CategoryPicker", () => {
  it("selects an existing category by id", async () => {
    const onChange = vi.fn();
    render(
      <CategoryPicker
        categories={CATS}
        value={null}
        onChange={onChange}
        onCreate={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^work$/i }));
    expect(onChange).toHaveBeenCalledWith("c1");
  });

  it("offers create-on-type for an unknown name and selects the result", async () => {
    const created: Category = {
      id: "c2",
      user_id: "u1",
      name: "Home",
      color: "#10b981",
      created_at: "",
    };
    const onCreate = vi.fn().mockResolvedValue(created);
    const onChange = vi.fn();
    render(
      <CategoryPicker
        categories={CATS}
        value={null}
        onChange={onChange}
        onCreate={onCreate}
      />,
    );
    await userEvent.type(screen.getByRole("textbox"), "Home");
    await userEvent.click(
      screen.getByRole("button", { name: /create "home"/i }),
    );
    expect(onCreate).toHaveBeenCalledWith("Home");
    expect(onChange).toHaveBeenCalledWith("c2");
  });

  it("does not offer create when the name already exists", async () => {
    render(
      <CategoryPicker
        categories={CATS}
        value={null}
        onChange={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByRole("textbox"), "work");
    expect(
      screen.queryByRole("button", { name: /create "work"/i }),
    ).not.toBeInTheDocument();
  });
});
