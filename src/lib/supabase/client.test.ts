import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "./client";

describe("browser supabase client", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
  });

  it("creates a client exposing auth", () => {
    const supabase = createClient();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.auth.signInWithOtp).toBe("function");
  });
});
