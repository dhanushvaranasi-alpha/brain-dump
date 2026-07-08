import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp } }),
}));

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  beforeEach(() => signInWithOtp.mockClear());

  it("sends a magic link and shows confirmation", async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "me@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: /send magic link/i }),
    );

    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "me@example.com" }),
    );
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });
});
