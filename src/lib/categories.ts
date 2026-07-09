import type { SupabaseClient } from "@supabase/supabase-js";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CategoryInput {
  name: string;
  color: string;
}

export async function listCategories(
  supabase: SupabaseClient,
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as Category[] | null) ?? [];
}

export async function createCategory(
  supabase: SupabaseClient,
  input: CategoryInput,
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: input.name.trim(), color: input.color })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  supabase: SupabaseClient,
  id: string,
  input: Partial<CategoryInput>,
): Promise<Category> {
  const patch: Partial<CategoryInput> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.color !== undefined) patch.color = input.color;

  const { data, error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}
