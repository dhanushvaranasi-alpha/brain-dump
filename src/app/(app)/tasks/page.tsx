import { redirect } from "next/navigation";
import { listCategories } from "@/lib/categories";
import { listSubtasks } from "@/lib/subtasks";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks";
import { TaskList } from "./task-list";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tasks, categories, subtasks] = await Promise.all([
    listTasks(supabase),
    listCategories(supabase),
    listSubtasks(supabase),
  ]);
  return (
    <TaskList
      initialTasks={tasks}
      categories={categories}
      initialSubtasks={subtasks}
    />
  );
}
