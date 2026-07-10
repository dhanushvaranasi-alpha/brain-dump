import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createSubtask,
  deleteSubtask,
  diffSubtasks,
  listSubtasks,
  type Subtask,
  toggleSubtask,
} from "./subtasks";

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

function row(p: Partial<Subtask>): Subtask {
  return {
    id: "s1",
    task_id: "t1",
    title: "S",
    is_done: false,
    position: 0,
    created_at: "",
    ...p,
  };
}

describe("listSubtasks", () => {
  it("selects all subtasks ordered by position", async () => {
    const rows = [row({ id: "s1" })];
    const { client, from, builder } = mockSupabase({ data: rows, error: null });
    const result = await listSubtasks(client);
    expect(from).toHaveBeenCalledWith("subtasks");
    expect(builder.order).toHaveBeenCalledWith("position", { ascending: true });
    expect(result).toEqual(rows);
  });

  it("returns [] when data is null", async () => {
    const { client } = mockSupabase({ data: null, error: null });
    expect(await listSubtasks(client)).toEqual([]);
  });
});

describe("createSubtask", () => {
  it("inserts task_id, trimmed title, position and returns the row", async () => {
    const r = row({ id: "s2", title: "Milk" });
    const { client, builder } = mockSupabase({ data: r, error: null });
    const result = await createSubtask(client, {
      task_id: "t1",
      title: "  Milk  ",
      position: 2,
    });
    expect(builder.insert).toHaveBeenCalledWith({
      task_id: "t1",
      title: "Milk",
      position: 2,
    });
    expect(result).toEqual(r);
  });
});

describe("toggleSubtask", () => {
  it("updates is_done and returns the row", async () => {
    const r = row({ id: "s1", is_done: true });
    const { client, builder } = mockSupabase({ data: r, error: null });
    await toggleSubtask(client, "s1", true);
    expect(builder.update).toHaveBeenCalledWith({ is_done: true });
    expect(builder.eq).toHaveBeenCalledWith("id", "s1");
  });
});

describe("deleteSubtask", () => {
  it("deletes by id", async () => {
    const { client, builder } = mockSupabase({ data: null, error: null });
    await deleteSubtask(client, "s1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "s1");
  });

  it("throws on error", async () => {
    const { client } = mockSupabase({ data: null, error: new Error("no") });
    await expect(deleteSubtask(client, "s1")).rejects.toThrow("no");
  });
});

describe("diffSubtasks", () => {
  it("classifies creates, toggles, and deletes", () => {
    const original: Subtask[] = [
      row({ id: "keep", title: "keep", is_done: false }),
      row({ id: "flip", title: "flip", is_done: false }),
      row({ id: "gone", title: "gone", is_done: false }),
    ];
    const current = [
      { id: "keep", title: "keep", is_done: false }, // unchanged
      { id: "flip", title: "flip", is_done: true }, // toggled
      { title: "new", is_done: false }, // created (no id)
    ];
    const diff = diffSubtasks(original, current);
    expect(diff.toCreate).toEqual([{ title: "new", position: 2 }]);
    expect(diff.toToggle).toEqual([{ id: "flip", is_done: true }]);
    expect(diff.toDelete).toEqual(["gone"]);
  });
});
