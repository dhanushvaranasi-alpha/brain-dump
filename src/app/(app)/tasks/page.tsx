import { EmptyState } from "@/components/empty-state";

export default function TasksPage() {
  return (
    <EmptyState
      title="No tasks yet"
      description="Capture your first task — due dates, priorities, and checklists come next."
    />
  );
}
