# Tasks (core)

Capture, organize, edit, and complete tasks. Shipped in Phase 3. Power features
(subtasks, recurrence, filtering) are Phase 4.

## What's implemented

- `tasks` table (full, owner-scoped RLS) — `supabase/migrations/0003_tasks.sql`
  (RLS + cross-user isolation test: `supabase/tests/rls_tasks.test.sql`). The
  `recurrence` and `search_vector` columns are created now but unused until later.
- Data-access CRUD — `src/lib/tasks.ts` (`listTasks`, `createTask`, `updateTask`,
  `toggleComplete`, `deleteTask`); takes any Supabase client.
- Pure due-date grouping — `src/lib/task-groups.ts` (`groupTasks`): Overdue / Today /
  Upcoming / No date / Completed, comparing `due_at.slice(0,10)` to the local date.
- `/tasks` page — `src/app/(app)/tasks/page.tsx` (server: auth guard + SSR load of
  tasks + categories) + `task-list.tsx` (client: grouped list, floating "+",
  optimistic toggle/edit with sonner rollback; add is create-then-render).
- Components: `task-card.tsx` (check-off + tap-to-edit), `task-capture-modal.tsx`
  (create/edit form, reuses `CategoryPicker` + `TagInput`), `priority-flag.tsx`.

## How it works

- The page loads tasks + categories server-side; the client `TaskList` owns optimistic
  state. Toggling/editing roll back with a toast on failure; adding awaits the DB id.
- Due dates are date-only (`<input type="date">`), stored as `${date}T00:00:00.000Z`;
  grouping and display use `due_at.slice(0,10)` to stay timezone-stable.

## Subtasks (Phase 4)

- `subtasks` table (owner-scoped through the parent task's RLS) —
  `supabase/migrations/0004_subtasks.sql` (test: `supabase/tests/rls_subtasks.test.sql`).
- Data-access + reconcile — `src/lib/subtasks.ts` (`listSubtasks`, `createSubtask`,
  `toggleSubtask`, `deleteSubtask`, and the pure `diffSubtasks`).
- Managed in the capture/edit modal via `src/components/subtask-checklist.tsx`
  (add / check / delete, insertion order). The task card shows a "done/total" badge.
- Persistence: on create, the task saves first then subtasks insert; on edit,
  `diffSubtasks` computes create/toggle/delete against the loaded subtasks. The page
  loads all subtasks SSR (`page.tsx`), and `task-list.tsx` owns the optimistic state.

## Filtering (Phase 4)

- Pure `filterTasks` — `src/lib/task-filter.ts` (category + tags, matching ALL selected tags).
- `src/components/task-filter-bar.tsx` at the top of `/tasks`; the manager applies the
  filter over the loaded list, then `groupTasks` runs on the result (grouping unchanged).

## Out of scope (Phase 5)

- Recurrence engine — monthly/annually with an interval and a `lead_days` lead time;
  the next occurrence surfaces N days before its due date (config in `tasks.recurrence`).
