import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagInput } from "./tag-input";

describe("TagInput", () => {
  it("adds a trimmed tag on Enter", async () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "  work  {Enter}");
    expect(onChange).toHaveBeenCalledWith(["work"]);
  });

  it("does not add case-insensitive duplicates", async () => {
    const onChange = vi.fn();
    render(<TagInput value={["work"]} onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "WORK{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag via its remove button", async () => {
    const onChange = vi.fn();
    render(<TagInput value={["work", "home"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /remove work/i }));
    expect(onChange).toHaveBeenCalledWith(["home"]);
  });

  it("removes the last tag on Backspace when input is empty", async () => {
    const onChange = vi.fn();
    render(<TagInput value={["work", "home"]} onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "{Backspace}");
    expect(onChange).toHaveBeenCalledWith(["work"]);
  });
});
