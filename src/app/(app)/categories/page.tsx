import { redirect } from "next/navigation";
import { listCategories } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categories = await listCategories(supabase);
  return <CategoryManager initial={categories} />;
}
