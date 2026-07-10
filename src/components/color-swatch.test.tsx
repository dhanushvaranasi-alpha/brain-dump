import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ColorSwatch } from "./color-swatch";

describe("ColorSwatch", () => {
  it("exposes color via aria-label and pressed state", () => {
    render(<ColorSwatch color="#ef4444" selected onSelect={() => {}} />);
    const btn = screen.getByRole("button", { name: /color #ef4444/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onSelect with its color when clicked", async () => {
    const onSelect = vi.fn();
    render(
      <ColorSwatch color="#10b981" selected={false} onSelect={onSelect} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /color #10b981/i }),
    );
    expect(onSelect).toHaveBeenCalledWith("#10b981");
  });
});
