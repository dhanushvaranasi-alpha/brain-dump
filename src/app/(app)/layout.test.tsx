import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/tasks" }));

import { ThemeProvider } from "@/components/theme-provider";
import AppLayout from "./layout";

describe("AppLayout", () => {
  it("shows a link to the categories page", () => {
    render(
      <ThemeProvider>
        <AppLayout>
          <div>content</div>
        </AppLayout>
      </ThemeProvider>,
    );
    expect(screen.getByRole("link", { name: /categories/i })).toHaveAttribute(
      "href",
      "/categories",
    );
  });
});
