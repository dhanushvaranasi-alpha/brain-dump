import type { SupabaseClient } from "@supabase/supabase-js";

export type Priority = "none" | "low" | "med" | "high";
export type TaskStatus = "todo" | "done";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  tags: string[];
  priority: Priority;
  due_at: string | null;
  status: TaskStatus;
  recurrence: unknown | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  category_id?: string | null;
  tags?: string[];
  priority?: Priority;
  due_at?: string | null;
}

export async function listTasks(supabase: SupabaseClient): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Task[] | null) ?? [];
}

export async function createTask(
  supabase: SupabaseClient,
  input: TaskInput,
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title.trim(),
      description: input.description ?? null,
      category_id: input.category_id ?? null,
      tags: input.tags ?? [],
      priority: input.priority ?? "none",
      due_at: input.due_at ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(
  supabase: SupabaseClient,
  id: string,
  input: Partial<TaskInput>,
): Promise<Task> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.category_id !== undefined) patch.category_id = input.category_id;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.due_at !== undefined) patch.due_at = input.due_at;

  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function toggleComplete(
  supabase: SupabaseClient,
  id: string,
  done: boolean,
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: done ? "done" : "todo",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function deleteTask(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}
