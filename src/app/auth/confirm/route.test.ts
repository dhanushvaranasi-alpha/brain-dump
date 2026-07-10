import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

function req(url: string) {
  return new Request(url) as unknown as import("next/server").NextRequest;
}

describe("GET /auth/confirm", () => {
  beforeEach(() => exchangeCodeForSession.mockReset());

  it("redirects to next on success", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      req("http://localhost/auth/confirm?code=abc&next=/tasks"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/tasks");
  });

  it("redirects to /login on failure", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });
    const res = await GET(req("http://localhost/auth/confirm?code=bad"));
    expect(res.headers.get("location")).toContain("/login");
  });

  it("ignores a protocol-relative next and falls back to /tasks", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      req("http://localhost/auth/confirm?code=abc&next=//evil.com"),
    );
    expect(res.headers.get("location")).toBe("http://localhost/tasks");
  });

  it("ignores an absolute-URL next and falls back to /tasks", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      req("http://localhost/auth/confirm?code=abc&next=https://evil.com"),
    );
    expect(res.headers.get("location")).toBe("http://localhost/tasks");
  });

  it("ignores a backslash-tricked next and falls back to /tasks", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      req("http://localhost/auth/confirm?code=abc&next=/\\evil.com"),
    );
    expect(res.headers.get("location")).toBe("http://localhost/tasks");
  });

  it("preserves a safe local next path", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      req("http://localhost/auth/confirm?code=abc&next=/notes"),
    );
    expect(res.headers.get("location")).toBe("http://localhost/notes");
  });
});
