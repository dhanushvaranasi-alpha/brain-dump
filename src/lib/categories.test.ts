import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "./categories";

function mockSupabase(result: { data?: unknown; error?: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => builder),
    then: (resolve: (r: typeof result) => unknown) => resolve(result),
  };
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as SupabaseClient, from, builder };
}

describe("listCategories", () => {
  it("selects all categories ordered by name and returns rows", async () => {
    const rows = [{ id: "1", name: "Work" }];
    const { client, from, builder } = mockSupabase({ data: rows, error: null });
    const result = await listCategories(client);
    expect(from).toHaveBeenCalledWith("categories");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(result).toEqual(rows);
  });

  it("returns [] when data is null", async () => {
    const { client } = mockSupabase({ data: null, error: null });
    expect(await listCategories(client)).toEqual([]);
  });

  it("throws when Supabase returns an error", async () => {
    const { client } = mockSupabase({ data: null, error: new Error("boom") });
    await expect(listCategories(client)).rejects.toThrow("boom");
  });
});

describe("createCategory", () => {
  it("inserts a trimmed name with the given color and returns the row", async () => {
    const row = { id: "1", name: "Work", color: "#6366f1" };
    const { client, builder } = mockSupabase({ data: row, error: null });
    const result = await createCategory(client, {
      name: "  Work  ",
      color: "#6366f1",
    });
    expect(builder.insert).toHaveBeenCalledWith({
      name: "Work",
      color: "#6366f1",
    });
    expect(result).toEqual(row);
  });
});

describe("updateCategory", () => {
  it("updates only provided fields, trims name, and returns the row", async () => {
    const row = { id: "1", name: "Home", color: "#10b981" };
    const { client, builder } = mockSupabase({ data: row, error: null });
    const result = await updateCategory(client, "1", { name: " Home " });
    expect(builder.update).toHaveBeenCalledWith({ name: "Home" });
    expect(builder.eq).toHaveBeenCalledWith("id", "1");
    expect(result).toEqual(row);
  });
});

describe("deleteCategory", () => {
  it("deletes by id and resolves", async () => {
    const { client, builder } = mockSupabase({ data: null, error: null });
    await deleteCategory(client, "1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "1");
  });

  it("throws when Supabase returns an error", async () => {
    const { client } = mockSupabase({ data: null, error: new Error("nope") });
    await expect(deleteCategory(client, "1")).rejects.toThrow("nope");
  });
});
