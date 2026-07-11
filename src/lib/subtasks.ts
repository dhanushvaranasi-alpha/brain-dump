import type { SupabaseClient } from "@supabase/supabase-js";

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

export interface SubtaskItem {
  id?: string;
  title: string;
  is_done: boolean;
}

export interface SubtaskInput {
  task_id: string;
  title: string;
  position: number;
}

export async function listSubtasks(
  supabase: SupabaseClient,
): Promise<Subtask[]> {
  const { data, error } = await supabase
    .from("subtasks")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data as Subtask[] | null) ?? [];
}

export async function createSubtask(
  supabase: SupabaseClient,
  input: SubtaskInput,
): Promise<Subtask> {
  const { data, error } = await supabase
    .from("subtasks")
    .insert({
      task_id: input.task_id,
      title: input.title.trim(),
      position: input.position,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Subtask;
}

export async function toggleSubtask(
  supabase: SupabaseClient,
  id: string,
  is_done: boolean,
): Promise<Subtask> {
  const { data, error } = await supabase
    .from("subtasks")
    .update({ is_done })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Subtask;
}

export async function deleteSubtask(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("subtasks").delete().eq("id", id);
  if (error) throw error;
}

// Pure reconcile of a task's persisted subtasks against the modal's edited list.
export function diffSubtasks(
  original: Subtask[],
  current: SubtaskItem[],
): {
  toCreate: { title: string; position: number }[];
  toToggle: { id: string; is_done: boolean }[];
  toDelete: string[];
} {
  const currentIds = new Set(
    current.filter((s) => s.id).map((s) => s.id as string),
  );
  const originalById = new Map(original.map((s) => [s.id, s]));

  const toCreate: { title: string; position: number }[] = [];
  const toToggle: { id: string; is_done: boolean }[] = [];
  current.forEach((item, index) => {
    if (!item.id) {
      toCreate.push({ title: item.title.trim(), position: index });
      return;
    }
    const prev = originalById.get(item.id);
    if (prev && prev.is_done !== item.is_done) {
      toToggle.push({ id: item.id, is_done: item.is_done });
    }
  });

  const toDelete = original
    .filter((s) => !currentIds.has(s.id))
    .map((s) => s.id);

  return { toCreate, toToggle, toDelete };
}
