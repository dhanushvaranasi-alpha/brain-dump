import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/tasks" }));

import { ViewNav } from "./view-nav";

describe("ViewNav", () => {
  it("links to tasks and notes and marks the active one", () => {
    render(<ViewNav />);
    const tasks = screen.getByRole("link", { name: /tasks/i });
    const notes = screen.getByRole("link", { name: /notes/i });
    expect(tasks).toHaveAttribute("href", "/tasks");
    expect(notes).toHaveAttribute("href", "/notes");
    expect(tasks).toHaveAttribute("aria-current", "page");
    expect(notes).not.toHaveAttribute("aria-current", "page");
  });
});
