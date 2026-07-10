import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";

// AnimatePresence keeps exiting children mounted until their exit animation
// finishes, which never completes synchronously in the test DOM. Render the
// animation wrappers as plain elements so optimistic unmount is immediate.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Tag = tag as keyof React.JSX.IntrinsicElements;
        return ({
          children,
          layout: _layout,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          whileHover: _whileHover,
          whileTap: _whileTap,
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

const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock("@/lib/categories", () => ({
  createCategory: (...a: unknown[]) => create(...a),
  updateCategory: (...a: unknown[]) => update(...a),
  deleteCategory: (...a: unknown[]) => remove(...a),
}));

import { CategoryManager } from "./category-manager";

const CATS: Category[] = [
  { id: "c1", user_id: "u1", name: "Work", color: "#6366f1", created_at: "" },
];

beforeEach(() => {
  create.mockReset();
  update.mockReset();
  remove.mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("CategoryManager", () => {
  it("renders the initial categories", () => {
    render(<CategoryManager initial={CATS} />);
    expect(screen.getByDisplayValue("Work")).toBeInTheDocument();
  });

  it("adds a category on submit", async () => {
    create.mockResolvedValue({
      id: "c2",
      user_id: "u1",
      name: "Home",
      color: "#8b5cf6",
      created_at: "",
    });
    render(<CategoryManager initial={CATS} />);
    await userEvent.type(screen.getByPlaceholderText(/new category/i), "Home");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getByDisplayValue("Home")).toBeInTheDocument();
    expect(create).toHaveBeenCalled();
  });

  it("optimistically removes a category on delete", async () => {
    remove.mockResolvedValue(undefined);
    render(<CategoryManager initial={CATS} />);
    await userEvent.click(screen.getByRole("button", { name: /delete work/i }));
    expect(screen.queryByDisplayValue("Work")).not.toBeInTheDocument();
    expect(remove).toHaveBeenCalledWith(expect.anything(), "c1");
  });

  it("rolls back and toasts when a delete fails", async () => {
    remove.mockRejectedValue(new Error("fail"));
    render(<CategoryManager initial={CATS} />);
    await userEvent.click(screen.getByRole("button", { name: /delete work/i }));
    // optimistic removal was rolled back → the row is restored
    expect(screen.getByDisplayValue("Work")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });

  it("does not add and toasts when a create fails", async () => {
    create.mockRejectedValue(new Error("fail"));
    render(<CategoryManager initial={CATS} />);
    await userEvent.type(screen.getByPlaceholderText(/new category/i), "Home");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.queryByDisplayValue("Home")).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });

  it("toasts when a rename fails", async () => {
    update.mockRejectedValue(new Error("fail"));
    render(<CategoryManager initial={CATS} />);
    const input = screen.getByLabelText(/rename work/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Admin");
    await userEvent.tab();
    expect(update).toHaveBeenCalledWith(expect.anything(), "c1", {
      name: "Admin",
    });
    expect(toast.error).toHaveBeenCalled();
  });
});
