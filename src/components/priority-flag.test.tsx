import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriorityFlag } from "./priority-flag";

describe("PriorityFlag", () => {
  it("renders an accessible flag for a real priority", () => {
    render(<PriorityFlag priority="high" />);
    expect(screen.getByLabelText(/priority: high/i)).toBeInTheDocument();
  });

  it("renders nothing for none", () => {
    const { container } = render(<PriorityFlag priority="none" />);
    expect(container).toBeEmptyDOMElement();
  });
});
