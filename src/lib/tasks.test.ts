import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createTask,
  deleteTask,
  listTasks,
  toggleComplete,
  updateTask,
} from "./tasks";

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

describe("listTasks", () => {
  it("selects all tasks newest-first and returns rows", async () => {
    const rows = [{ id: "1", title: "A" }];
    const { client, from, builder } = mockSupabase({ data: rows, error: null });
    const result = await listTasks(client);
    expect(from).toHaveBeenCalledWith("tasks");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(result).toEqual(rows);
  });

  it("returns [] when data is null", async () => {
    const { client } = mockSupabase({ data: null, error: null });
    expect(await listTasks(client)).toEqual([]);
  });

  it("throws when Supabase returns an error", async () => {
    const { client } = mockSupabase({ data: null, error: new Error("boom") });
    await expect(listTasks(client)).rejects.toThrow("boom");
  });
});

describe("createTask", () => {
  it("inserts a trimmed title with fields and returns the row", async () => {
    const row = { id: "1", title: "Buy milk" };
    const { client, builder } = mockSupabase({ data: row, error: null });
    const result = await createTask(client, {
      title: "  Buy milk  ",
      priority: "high",
      due_at: "2026-07-15T00:00:00.000Z",
    });
    expect(builder.insert).toHaveBeenCalledWith({
      title: "Buy milk",
      description: null,
      category_id: null,
      tags: [],
      priority: "high",
      due_at: "2026-07-15T00:00:00.000Z",
    });
    expect(result).toEqual(row);
  });

  it("throws when Supabase returns an error", async () => {
    const { client } = mockSupabase({ data: null, error: new Error("no") });
    await expect(createTask(client, { title: "x" })).rejects.toThrow("no");
  });
});

describe("updateTask", () => {
  it("updates only provided fields, trims title, and returns the row", async () => {
    const row = { id: "1", title: "Renamed" };
    const { client, builder } = mockSupabase({ data: row, error: null });
    const result = await updateTask(client, "1", { title: " Renamed " });
    expect(builder.update).toHaveBeenCalledWith({ title: "Renamed" });
    expect(builder.eq).toHaveBeenCalledWith("id", "1");
    expect(result).toEqual(row);
  });
});

describe("toggleComplete", () => {
  it("marks done with a completed_at timestamp", async () => {
    const row = { id: "1", status: "done" };
    const { client, builder } = mockSupabase({ data: row, error: null });
    await toggleComplete(client, "1", true);
    const arg = (builder.update.mock.calls[0] as unknown[])[0] as {
      status: string;
      completed_at: string | null;
    };
    expect(arg.status).toBe("done");
    expect(typeof arg.completed_at).toBe("string");
  });

  it("marks todo and clears completed_at", async () => {
    const row = { id: "1", status: "todo" };
    const { client, builder } = mockSupabase({ data: row, error: null });
    await toggleComplete(client, "1", false);
    expect(builder.update).toHaveBeenCalledWith({
      status: "todo",
      completed_at: null,
    });
  });
});

describe("deleteTask", () => {
  it("deletes by id and resolves", async () => {
    const { client, builder } = mockSupabase({ data: null, error: null });
    await deleteTask(client, "1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "1");
  });
});
