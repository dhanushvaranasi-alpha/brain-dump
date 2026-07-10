import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GlassPanel } from "./glass-panel";

describe("GlassPanel", () => {
  it("renders children and applies a backdrop-blur surface", () => {
    render(<GlassPanel data-testid="p">hello</GlassPanel>);
    const el = screen.getByTestId("p");
    expect(el).toHaveTextContent("hello");
    expect(el.className).toMatch(/backdrop-blur/);
  });
});
