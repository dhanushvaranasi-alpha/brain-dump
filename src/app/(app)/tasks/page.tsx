import { redirect } from "next/navigation";
import { listCategories } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks";
import { TaskList } from "./task-list";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tasks, categories] = await Promise.all([
    listTasks(supabase),
    listCategories(supabase),
  ]);
  return <TaskList initialTasks={tasks} categories={categories} />;
}
