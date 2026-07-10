# brain-dump Phase 3: Tasks Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user capture, organize, edit, and complete **tasks** — a full `tasks` table with owner-scoped RLS, a quick-capture modal (floating "+"), a `/tasks` list grouped by due date (Overdue / Today / Upcoming / No date / Completed), priority flags, and a satisfying check-off-to-complete.

**Architecture:** A new `tasks` table follows the exact owner-scoped RLS pattern from `categories` (`0002`), and is created **complete** (including `recurrence` jsonb and a generated `search_vector` that stay unused until later phases) so it never needs `ALTER`-ing. A framework-agnostic `lib/tasks.ts` wraps CRUD and takes a Supabase client, reused by the server page (SSR load + auth guard) and the client manager (optimistic mutations). Pure due-date grouping lives in `lib/task-groups.ts` (unit-tested in isolation). The `/tasks` page loads tasks + categories server-side and hands them to a client `TaskList` that owns optimistic state; capture/edit happen in a reused `TaskCaptureModal`. Phase 2's `CategoryPicker`, `TagInput`, `GlassPanel`, and `sonner` toasts are reused directly.

**Tech Stack:** Next.js 16 (App Router, server + client components), TypeScript, Tailwind v4, `@supabase/ssr` + `@supabase/supabase-js`, `framer-motion`, `lucide-react`, `sonner`, Vitest + @testing-library/react + happy-dom, Biome. Package manager: **Bun**.

## Global Constraints

- Package manager is **Bun** — `bun add`, `bun add -d`, `bunx`. Never npm/pnpm.
- **Never run the dev server or a production build** to verify. Verify only with `bun run test`, `bunx tsc --noEmit`, `bunx biome check .` (auto-fix: `bunx biome check --write .`).
- Commit messages: short, conventional prefixes (`feat:`, `test:`, `docs:`). Never mention any AI assistant/model/vendor.
- **Multi-user, isolated spaces:** every table is owner-scoped by RLS (`auth.uid() = user_id`); `user_id` defaults to `auth.uid()`. Tasks are per-user; no cross-user sharing (v2).
- Route-group paths contain `(app)` — **always quote** them in shell commands: `bun run test "src/app/(app)/tasks/..."`, `git add "src/app/(app)/tasks"`. Unquoted, zsh globs and fails.
- Glassmorphism aesthetic: reuse `GlassPanel` and the existing glass utility classes (`border border-white/20 bg-white/10 backdrop-blur-2xl shadow-xl`); respect `prefers-reduced-motion`.
- **Out of scope for Phase 3 (do NOT build):** subtasks, the recurrence engine (the `recurrence` column is created but never read/written here), and category/tag filtering. These are Phase 4. The migration DOES create the `recurrence` and `search_vector` columns so Phase 4/Search need no `ALTER`.

---

## File Structure

```
brain-dump/
├── supabase/
│   ├── migrations/
│   │   └── 0003_tasks.sql                # NEW: full tasks table + RLS + indexes
│   └── tests/
│       └── rls_tasks.test.sql            # NEW: RLS enabled + anon-denied + cross-user isolation
├── src/
│   ├── app/(app)/tasks/
│   │   ├── page.tsx                      # REPLACE empty state: server auth guard + SSR load
│   │   ├── task-list.tsx                 # NEW: client optimistic manager + grouping + "+"
│   │   └── task-list.test.tsx            # NEW
│   ├── components/
│   │   ├── priority-flag.tsx             # NEW: small priority indicator
│   │   ├── priority-flag.test.tsx        # NEW
│   │   ├── task-card.tsx                 # NEW: one task row (check-off, tap-to-edit)
│   │   ├── task-card.test.tsx            # NEW
│   │   ├── task-capture-modal.tsx        # NEW: create/edit form modal
│   │   └── task-capture-modal.test.tsx   # NEW
│   └── lib/
│       ├── tasks.ts                      # NEW: Task type + CRUD data-access
│       ├── tasks.test.ts                 # NEW
│       ├── task-groups.ts                # NEW: pure due-date grouping
│       └── task-groups.test.ts           # NEW
└── docs/
    └── tasks.md                          # NEW: feature doc
```

**Interfaces exported by this phase (consumed later / across tasks):**

- `lib/tasks.ts` → `Task`, `Priority`, `TaskStatus`, `TaskInput` types; `listTasks`, `createTask`, `updateTask`, `toggleComplete`, `deleteTask`
- `lib/task-groups.ts` → `GroupedTasks` type; `GROUP_ORDER`, `GROUP_LABELS`; `groupTasks(tasks, todayKey)`
- `components/priority-flag.tsx` → `PriorityFlag` (props: `priority`)
- `components/task-card.tsx` → `TaskCard` (props: `task`, `onToggle`, `onEdit`)
- `components/task-capture-modal.tsx` → `TaskCaptureModal` (props: `open`, `initial?`, `categories`, `onClose`, `onSubmit`, `onCreateCategory`)

**Reused from Phase 2 (do not rebuild):**
- `components/category-picker.tsx` → `CategoryPicker` (props: `categories`, `value`, `onChange`, `onCreate`)
- `components/tag-input.tsx` → `TagInput` (props: `value`, `onChange`, `placeholder?`)
- `components/glass-panel.tsx` → `GlassPanel` (props: `intensity`, `className`, motion props)
- `lib/categories.ts` → `Category`, `listCategories`, `createCategory`
- `sonner` → `toast`

---

## Task 1: `tasks` table migration + RLS + RLS test

**Files:**
- Create: `supabase/migrations/0003_tasks.sql`
- Create: `supabase/tests/rls_tasks.test.sql`

**Interfaces:**
- Produces: `public.tasks` with columns `id, user_id, title, description, category_id, tags, priority, due_at, status, recurrence, completed_at, created_at, updated_at, search_vector`; RLS enabled with four owner-scoped policies; `user_id default auth.uid()`; `category_id` FK `on delete set null`; GIN indexes on `tags` and `search_vector`; a `(user_id)` index.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_tasks.sql`:

```sql
-- tasks: user-owned to-do items. Created complete (recurrence + search_vector
-- columns included now) so later phases never ALTER this table. Follows the
-- owner-scoped RLS pattern from 0002_categories.sql.
create type public.task_priority as enum ('none', 'low', 'med', 'high');
create type public.task_status as enum ('todo', 'done');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  tags text[] not null default '{}',
  priority public.task_priority not null default 'none',
  due_at timestamptz,
  status public.task_status not null default 'todo',
  recurrence jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Unused until Search; generated from title + description.
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_tags_gin on public.tasks using gin (tags);
create index tasks_search_gin on public.tasks using gin (search_vector);

alter table public.tasks enable row level security;

create policy "tasks are viewable by owner"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "tasks are insertable by owner"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "tasks are updatable by owner"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks are deletable by owner"
  on public.tasks for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Write the RLS test**

Create `supabase/tests/rls_tasks.test.sql` (mirrors `rls_categories.test.sql`, adds cross-user isolation):

```sql
begin;
select plan(4);

-- RLS is enabled on tasks
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tasks'::regclass),
  'RLS enabled on tasks'
);

-- anon role cannot read tasks (no rows visible without auth.uid())
set local role anon;
select is_empty(
  'select 1 from public.tasks',
  'anon sees no task rows'
);
reset role;

-- Seed two users, each owning one task, to prove cross-user isolation.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com');
insert into public.tasks (user_id, title) values
  ('11111111-1111-1111-1111-111111111111', 'A task'),
  ('22222222-2222-2222-2222-222222222222', 'B task');

-- As user A (authenticated): sees only their own task, never user B's.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*) from public.tasks',
  ARRAY[1::bigint],
  'user A sees only their own task (cross-user isolation)'
);

-- As user A: cannot delete user B's task (delete policy is owner-scoped).
select is_empty(
  $$ delete from public.tasks
     where user_id = '22222222-2222-2222-2222-222222222222'::uuid
     returning 1 $$,
  'user A cannot delete user B task'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Apply the migration**

Apply via whichever path is available (see the Phase 3 handoff notes): `bunx supabase db reset` (local Docker), `bunx supabase db push` (linked CLI), or paste `0003_tasks.sql` into the dashboard SQL Editor.
Expected: `public.tasks` exists with RLS enabled; no SQL errors. (If no live DB is available in this environment, the migration is written + committed and application is deferred — note it in the report.)

- [ ] **Step 4: Verify RLS (if pgTAP / local DB available)**

Run: `bunx supabase test db`
Expected: `rls_tasks.test.sql` passes 4/4. (If no local DB, verify the table + policies manually in the dashboard.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_tasks.sql supabase/tests/rls_tasks.test.sql
git commit -m "feat: add tasks table with owner-scoped RLS"
```

---

## Task 2: `lib/tasks.ts` — data-access module

**Files:**
- Create: `src/lib/tasks.ts`
- Test: `src/lib/tasks.test.ts`

**Interfaces:**
- Consumes: a `SupabaseClient` from `@supabase/supabase-js`.
- Produces:
  - `type Priority = "none" | "low" | "med" | "high"`
  - `type TaskStatus = "todo" | "done"`
  - `interface Task { id: string; user_id: string; title: string; description: string | null; category_id: string | null; tags: string[]; priority: Priority; due_at: string | null; status: TaskStatus; recurrence: unknown | null; completed_at: string | null; created_at: string; updated_at: string }`
  - `interface TaskInput { title: string; description?: string | null; category_id?: string | null; tags?: string[]; priority?: Priority; due_at?: string | null }`
  - `listTasks(supabase): Promise<Task[]>` — ordered by `created_at` descending
  - `createTask(supabase, input): Promise<Task>` — trims title; `user_id` filled by DB default
  - `updateTask(supabase, id, input: Partial<TaskInput>): Promise<Task>`
  - `toggleComplete(supabase, id, done: boolean): Promise<Task>` — sets `status` + `completed_at`
  - `deleteTask(supabase, id): Promise<void>`
  - Each throws the Supabase error on failure.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tasks.test.ts` (same thenable-mock pattern as `categories.test.ts`):

```typescript
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
    const arg = builder.update.mock.calls[0][0] as {
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/lib/tasks.test.ts`
Expected: FAIL — cannot import from `./tasks`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/tasks.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/tasks.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check src/lib/tasks.ts src/lib/tasks.test.ts`
Expected: no type errors; Biome clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tasks.ts src/lib/tasks.test.ts
git commit -m "feat: add tasks data-access module"
```

---

## Task 3: `lib/task-groups.ts` — due-date grouping

**Files:**
- Create: `src/lib/task-groups.ts`
- Test: `src/lib/task-groups.test.ts`

**Interfaces:**
- Consumes: `Task` from `lib/tasks.ts`.
- Produces:
  - `interface GroupedTasks { overdue: Task[]; today: Task[]; upcoming: Task[]; noDate: Task[]; completed: Task[] }`
  - `GROUP_ORDER: (keyof GroupedTasks)[]` = `["overdue","today","upcoming","noDate","completed"]`
  - `GROUP_LABELS: Record<keyof GroupedTasks, string>`
  - `groupTasks(tasks: Task[], todayKey: string): GroupedTasks` — `todayKey` is the local calendar date as `"YYYY-MM-DD"`. A task is `completed` if `status === "done"`; else `noDate` if `due_at` is null; else compares `due_at.slice(0,10)` to `todayKey` (`<` overdue, `===` today, `>` upcoming).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/task-groups.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { Task } from "./tasks";
import { GROUP_ORDER, groupTasks } from "./task-groups";

function task(partial: Partial<Task>): Task {
  return {
    id: "t",
    user_id: "u",
    title: "T",
    description: null,
    category_id: null,
    tags: [],
    priority: "none",
    due_at: null,
    status: "todo",
    recurrence: null,
    completed_at: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("groupTasks", () => {
  const today = "2026-07-10";

  it("buckets by due date relative to today", () => {
    const tasks = [
      task({ id: "past", due_at: "2026-07-01T00:00:00.000Z" }),
      task({ id: "now", due_at: "2026-07-10T00:00:00.000Z" }),
      task({ id: "future", due_at: "2026-07-20T00:00:00.000Z" }),
      task({ id: "none" }),
    ];
    const g = groupTasks(tasks, today);
    expect(g.overdue.map((t) => t.id)).toEqual(["past"]);
    expect(g.today.map((t) => t.id)).toEqual(["now"]);
    expect(g.upcoming.map((t) => t.id)).toEqual(["future"]);
    expect(g.noDate.map((t) => t.id)).toEqual(["none"]);
  });

  it("puts done tasks in completed regardless of due date", () => {
    const tasks = [
      task({ id: "d", status: "done", due_at: "2026-07-01T00:00:00.000Z" }),
    ];
    const g = groupTasks(tasks, today);
    expect(g.completed.map((t) => t.id)).toEqual(["d"]);
    expect(g.overdue).toEqual([]);
  });

  it("exposes a stable group order", () => {
    expect(GROUP_ORDER).toEqual([
      "overdue",
      "today",
      "upcoming",
      "noDate",
      "completed",
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/lib/task-groups.test.ts`
Expected: FAIL — cannot import from `./task-groups`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/task-groups.ts`:

```typescript
import type { Task } from "./tasks";

export interface GroupedTasks {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  noDate: Task[];
  completed: Task[];
}

export const GROUP_ORDER: (keyof GroupedTasks)[] = [
  "overdue",
  "today",
  "upcoming",
  "noDate",
  "completed",
];

export const GROUP_LABELS: Record<keyof GroupedTasks, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  noDate: "No date",
  completed: "Completed",
};

// `todayKey` is the local calendar date as "YYYY-MM-DD".
export function groupTasks(tasks: Task[], todayKey: string): GroupedTasks {
  const groups: GroupedTasks = {
    overdue: [],
    today: [],
    upcoming: [],
    noDate: [],
    completed: [],
  };
  for (const task of tasks) {
    if (task.status === "done") {
      groups.completed.push(task);
    } else if (!task.due_at) {
      groups.noDate.push(task);
    } else {
      const dueKey = task.due_at.slice(0, 10);
      if (dueKey < todayKey) groups.overdue.push(task);
      else if (dueKey === todayKey) groups.today.push(task);
      else groups.upcoming.push(task);
    }
  }
  return groups;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/task-groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/task-groups.ts src/lib/task-groups.test.ts
git commit -m "feat: add due-date grouping for tasks"
```

---

## Task 4: `PriorityFlag` component

**Files:**
- Create: `src/components/priority-flag.tsx`
- Test: `src/components/priority-flag.test.tsx`

**Interfaces:**
- Consumes: `Priority` from `lib/tasks.ts`.
- Produces: `PriorityFlag` — props `{ priority: Priority }`. Renders nothing for `"none"`; otherwise a small colored `Flag` icon with `aria-label={`Priority: ${priority}`}` (low = slate, med = amber, high = red).

- [ ] **Step 1: Write the failing test**

Create `src/components/priority-flag.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriorityFlag } from "./priority-flag";

describe("PriorityFlag", () => {
  it("renders an accessible flag for a real priority", () => {
    render(<PriorityFlag priority="high" />);
    expect(screen.getByLabelText(/priority: high/i)).toBeInTheDocument();
  });

  it("renders nothing for none", () => {
    const { container } = render(<PriorityFlag priority="none" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/components/priority-flag.test.tsx`
Expected: FAIL — `./priority-flag` has no `PriorityFlag` export.

- [ ] **Step 3: Write the implementation**

Create `src/components/priority-flag.tsx`:

```tsx
import { Flag } from "lucide-react";
import type { Priority } from "@/lib/tasks";

const COLORS: Record<Exclude<Priority, "none">, string> = {
  low: "text-slate-400",
  med: "text-amber-400",
  high: "text-red-400",
};

export function PriorityFlag({ priority }: { priority: Priority }) {
  if (priority === "none") return null;
  return (
    <Flag
      aria-label={`Priority: ${priority}`}
      className={`h-3.5 w-3.5 ${COLORS[priority]}`}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/components/priority-flag.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/priority-flag.tsx src/components/priority-flag.test.tsx
git commit -m "feat: add priority flag component"
```

---

## Task 5: `TaskCard` component

**Files:**
- Create: `src/components/task-card.tsx`
- Test: `src/components/task-card.test.tsx`

**Interfaces:**
- Consumes: `Task` from `lib/tasks.ts`; `PriorityFlag`.
- Produces: `TaskCard` — props `{ task: Task; onToggle: (task: Task) => void; onEdit: (task: Task) => void }`.
  - A checkbox button labelled `${task.status === "done" ? "Mark incomplete" : "Complete"} ${task.title}` calls `onToggle(task)`.
  - The title area is a button labelled `Edit ${task.title}` calling `onEdit(task)`.
  - Shows the title (struck through when done), the `PriorityFlag`, and the due date (if any, formatted `YYYY-MM-DD` from `due_at.slice(0,10)`).

- [ ] **Step 1: Write the failing tests**

Create `src/components/task-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/tasks";
import { TaskCard } from "./task-card";

function task(p: Partial<Task>): Task {
  return {
    id: "t1",
    user_id: "u",
    title: "Buy milk",
    description: null,
    category_id: null,
    tags: [],
    priority: "high",
    due_at: "2026-07-15T00:00:00.000Z",
    status: "todo",
    recurrence: null,
    completed_at: null,
    created_at: "",
    updated_at: "",
    ...p,
  };
}

describe("TaskCard", () => {
  it("shows the title, priority, and due date", () => {
    render(<TaskCard task={task({})} onToggle={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByLabelText(/priority: high/i)).toBeInTheDocument();
    expect(screen.getByText("2026-07-15")).toBeInTheDocument();
  });

  it("toggles completion when the checkbox is clicked", async () => {
    const onToggle = vi.fn();
    render(<TaskCard task={task({})} onToggle={onToggle} onEdit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /complete buy milk/i }));
    expect(onToggle).toHaveBeenCalled();
  });

  it("requests edit when the title is clicked", async () => {
    const onEdit = vi.fn();
    render(<TaskCard task={task({})} onToggle={vi.fn()} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole("button", { name: /edit buy milk/i }));
    expect(onEdit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/task-card.test.tsx`
Expected: FAIL — `./task-card` has no `TaskCard` export.

- [ ] **Step 3: Write the implementation**

Create `src/components/task-card.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { Task } from "@/lib/tasks";
import { PriorityFlag } from "./priority-flag";

interface TaskCardProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
}

export function TaskCard({ task, onToggle, onEdit }: TaskCardProps) {
  const done = task.status === "done";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-2xl"
    >
      <motion.button
        type="button"
        aria-label={`${done ? "Mark incomplete" : "Complete"} ${task.title}`}
        onClick={() => onToggle(task)}
        whileTap={{ scale: 0.8 }}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
          done
            ? "border-emerald-400 bg-emerald-500/80 text-white"
            : "border-white/40 hover:border-white/70"
        }`}
      >
        {done && <Check className="h-3.5 w-3.5" />}
      </motion.button>
      <button
        type="button"
        aria-label={`Edit ${task.title}`}
        onClick={() => onEdit(task)}
        className="flex flex-1 items-center gap-2 text-left"
      >
        <span className={`flex-1 text-sm ${done ? "line-through opacity-60" : ""}`}>
          {task.title}
        </span>
        <PriorityFlag priority={task.priority} />
        {task.due_at && (
          <span className="text-xs opacity-70">{task.due_at.slice(0, 10)}</span>
        )}
      </button>
    </motion.li>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/components/task-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check src/components/task-card.tsx src/components/task-card.test.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/task-card.tsx src/components/task-card.test.tsx
git commit -m "feat: add task card component"
```

---

## Task 6: `TaskCaptureModal` component (create + edit)

**Files:**
- Create: `src/components/task-capture-modal.tsx`
- Test: `src/components/task-capture-modal.test.tsx`

**Interfaces:**
- Consumes: `Task`, `TaskInput`, `Priority` from `lib/tasks.ts`; `Category` from `lib/categories.ts`; `CategoryPicker`, `TagInput`, `GlassPanel`.
- Produces: `TaskCaptureModal` — props:
  - `open: boolean`
  - `initial?: Task | null` — when set, the form is pre-filled (edit mode) and the heading reads "Edit task"; otherwise "New task".
  - `categories: Category[]`
  - `onClose: () => void`
  - `onSubmit: (input: TaskInput) => Promise<void>` — called with the form values; `due_at` is `${dateStr}T00:00:00.000Z` or null.
  - `onCreateCategory: (name: string) => Promise<Category>` — passed to the picker's `onCreate`.
  - Renders nothing when `open` is false. Title is required (submit disabled when empty). On submit, calls `onSubmit`, then `onClose`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/task-capture-modal.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";
import type { Task } from "@/lib/tasks";
import { TaskCaptureModal } from "./task-capture-modal";

const CATS: Category[] = [
  { id: "c1", user_id: "u", name: "Home", color: "#6366f1", created_at: "" },
];

function baseProps() {
  return {
    open: true,
    categories: CATS,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCreateCategory: vi.fn(),
  };
}

describe("TaskCaptureModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <TaskCaptureModal {...baseProps()} open={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("submits a new task with a title and due date", async () => {
    const props = baseProps();
    render(<TaskCaptureModal {...props} />);
    await userEvent.type(screen.getByLabelText(/title/i), "Buy milk");
    fireEvent.change(screen.getByLabelText(/due date/i), {
      target: { value: "2026-07-15" },
    });
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Buy milk",
        due_at: "2026-07-15T00:00:00.000Z",
      }),
    );
    expect(props.onClose).toHaveBeenCalled();
  });

  it("pre-fills the form in edit mode", () => {
    const initial: Task = {
      id: "t1",
      user_id: "u",
      title: "Existing",
      description: null,
      category_id: null,
      tags: [],
      priority: "none",
      due_at: null,
      status: "todo",
      recurrence: null,
      completed_at: null,
      created_at: "",
      updated_at: "",
    };
    render(<TaskCaptureModal {...baseProps()} initial={initial} />);
    expect(screen.getByDisplayValue("Existing")).toBeInTheDocument();
    expect(screen.getByText(/edit task/i)).toBeInTheDocument();
  });

  it("disables save when the title is empty", () => {
    render(<TaskCaptureModal {...baseProps()} />);
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/task-capture-modal.test.tsx`
Expected: FAIL — `./task-capture-modal` has no `TaskCaptureModal` export.

- [ ] **Step 3: Write the implementation**

Create `src/components/task-capture-modal.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Category } from "@/lib/categories";
import type { Priority, Task, TaskInput } from "@/lib/tasks";
import { CategoryPicker } from "./category-picker";
import { GlassPanel } from "./glass-panel";
import { TagInput } from "./tag-input";

const PRIORITIES: Priority[] = ["none", "low", "med", "high"];

interface TaskCaptureModalProps {
  open: boolean;
  initial?: Task | null;
  categories: Category[];
  onClose: () => void;
  onSubmit: (input: TaskInput) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category>;
}

export function TaskCaptureModal({
  open,
  initial,
  categories,
  onClose,
  onSubmit,
  onCreateCategory,
}: TaskCaptureModalProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    initial?.category_id ?? null,
  );
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [priority, setPriority] = useState<Priority>(
    initial?.priority ?? "none",
  );
  const [dueDate, setDueDate] = useState(initial?.due_at?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const canSave = title.trim().length > 0 && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        tags,
        priority,
        due_at: dueDate ? `${dueDate}T00:00:00.000Z` : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
          <GlassPanel intensity="strong" className="!p-5">
            <h2 className="mb-4 text-lg font-semibold">
              {initial ? "Edit task" : "New task"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-sm font-medium" htmlFor="task-title">
                Title
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />

              <label className="block text-sm font-medium" htmlFor="task-desc">
                Description
              </label>
              <textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />

              <span className="block text-sm font-medium">Category</span>
              <CategoryPicker
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                onCreate={onCreateCategory}
              />

              <span className="block text-sm font-medium">Tags</span>
              <TagInput value={tags} onChange={setTags} />

              <span className="block text-sm font-medium">Priority</span>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-full px-3 py-1 text-sm capitalize transition ${
                      priority === p ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-medium" htmlFor="task-due">
                Due date
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-sm hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSave}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          </GlassPanel>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/components/task-capture-modal.test.tsx`
Expected: PASS — all four cases green.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check src/components/task-capture-modal.tsx src/components/task-capture-modal.test.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/task-capture-modal.tsx src/components/task-capture-modal.test.tsx
git commit -m "feat: add task capture modal (create + edit)"
```

---

## Task 7: `/tasks` page + `TaskList` (optimistic manager)

**Files:**
- Modify: `src/app/(app)/tasks/page.tsx` (replace the empty-state page)
- Create: `src/app/(app)/tasks/task-list.tsx`
- Test: `src/app/(app)/tasks/task-list.test.tsx`

**Interfaces:**
- Consumes: `listTasks` + server client (page); `listCategories` (page, for the picker); `Task`, `TaskInput`, `createTask`, `updateTask`, `toggleComplete`, `deleteTask` + browser client; `Category`, `createCategory`; `groupTasks`, `GROUP_ORDER`, `GROUP_LABELS`; `TaskCard`; `TaskCaptureModal`; `EmptyState`; `toast`.
- Produces: the `/tasks` route — grouped list with a floating "+" that opens the capture modal; create-then-render add; optimistic toggle/edit/delete with toast rollback.

- [ ] **Step 1: Write the server page (auth guard + SSR load)**

Modify `src/app/(app)/tasks/page.tsx` (replace its whole contents):

```tsx
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
```

- [ ] **Step 2: Write the failing test for the manager**

Create `src/app/(app)/tasks/task-list.test.tsx` (mock the browser client, `sonner`, and the data-access modules; mock framer-motion to plain elements so optimistic unmount is synchronous — same reason as the categories manager):

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";
import type { Task } from "@/lib/tasks";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const Tag = tag as keyof React.JSX.IntrinsicElements;
        return ({
          children,
          layout: _l,
          initial: _i,
          animate: _a,
          exit: _e,
          whileHover: _wh,
          whileTap: _wt,
          ...rest
        }: Record<string, unknown> & { children?: React.ReactNode }) => (
          <Tag {...rest}>{children}</Tag>
        );
      },
    },
  ),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const createTask = vi.fn();
const updateTask = vi.fn();
const toggleComplete = vi.fn();
const deleteTask = vi.fn();
vi.mock("@/lib/tasks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tasks")>();
  return {
    ...actual,
    createTask: (...a: unknown[]) => createTask(...a),
    updateTask: (...a: unknown[]) => updateTask(...a),
    toggleComplete: (...a: unknown[]) => toggleComplete(...a),
    deleteTask: (...a: unknown[]) => deleteTask(...a),
  };
});
vi.mock("@/lib/categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/categories")>();
  return { ...actual, createCategory: vi.fn() };
});

import { TaskList } from "./task-list";

const CATS: Category[] = [
  { id: "c1", user_id: "u", name: "Home", color: "#6366f1", created_at: "" },
];
function task(p: Partial<Task>): Task {
  return {
    id: "t1",
    user_id: "u",
    title: "Buy milk",
    description: null,
    category_id: null,
    tags: [],
    priority: "none",
    due_at: null,
    status: "todo",
    recurrence: null,
    completed_at: null,
    created_at: "",
    updated_at: "",
    ...p,
  };
}

beforeEach(() => {
  createTask.mockReset();
  updateTask.mockReset();
  toggleComplete.mockReset();
  deleteTask.mockReset();
});

describe("TaskList", () => {
  it("renders existing tasks grouped", () => {
    render(<TaskList initialTasks={[task({})]} categories={CATS} />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
  });

  it("shows an empty state when there are no tasks", () => {
    render(<TaskList initialTasks={[]} categories={CATS} />);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it("optimistically moves a task to completed on toggle", async () => {
    toggleComplete.mockResolvedValue(task({ status: "done" }));
    render(<TaskList initialTasks={[task({})]} categories={CATS} />);
    await userEvent.click(
      screen.getByRole("button", { name: /complete buy milk/i }),
    );
    expect(toggleComplete).toHaveBeenCalledWith(expect.anything(), "t1", true);
  });

  it("opens the edit modal pre-filled when a task is clicked", async () => {
    render(<TaskList initialTasks={[task({})]} categories={CATS} />);
    await userEvent.click(
      screen.getByRole("button", { name: /edit buy milk/i }),
    );
    expect(screen.getByDisplayValue("Buy milk")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test "src/app/(app)/tasks/task-list.test.tsx"`
Expected: FAIL — `./task-list` has no `TaskList` export.

- [ ] **Step 4: Write the client manager**

Create `src/app/(app)/tasks/task-list.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TaskCaptureModal } from "@/components/task-capture-modal";
import { TaskCard } from "@/components/task-card";
import { type Category, createCategory } from "@/lib/categories";
import { createClient } from "@/lib/supabase/client";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  groupTasks,
} from "@/lib/task-groups";
import {
  createTask,
  type Task,
  type TaskInput,
  toggleComplete,
  updateTask,
} from "@/lib/tasks";

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)
}

export function TaskList({
  initialTasks,
  categories,
}: {
  initialTasks: Task[];
  categories: Category[];
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const groups = groupTasks(tasks, todayKey());

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(task: Task) {
    setEditing(task);
    setModalOpen(true);
  }

  async function handleSubmit(input: TaskInput) {
    if (editing) {
      const prev = tasks;
      const target = editing;
      setTasks((ts) =>
        ts.map((t) => (t.id === target.id ? { ...t, ...input } : t)),
      );
      try {
        const saved = await updateTask(supabase, target.id, input);
        setTasks((ts) => ts.map((t) => (t.id === saved.id ? saved : t)));
      } catch {
        setTasks(prev);
        toast.error("Could not save task");
      }
    } else {
      try {
        const created = await createTask(supabase, input);
        setTasks((ts) => [created, ...ts]);
      } catch {
        toast.error("Could not add task");
      }
    }
  }

  async function handleToggle(task: Task) {
    const done = task.status !== "done";
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t.id === task.id ? { ...t, status: done ? "done" : "todo" } : t)),
    );
    try {
      const saved = await toggleComplete(supabase, task.id, done);
      setTasks((ts) => ts.map((t) => (t.id === saved.id ? saved : t)));
    } catch {
      setTasks(prev);
      toast.error("Could not update task");
    }
  }

  async function handleCreateCategory(name: string) {
    return createCategory(supabase, { name, color: "#6366f1" });
  }

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Tap the + button to capture your first task."
        />
      ) : (
        <div className="space-y-5">
          {GROUP_ORDER.map((key) => {
            const groupTasksList = groups[key];
            if (groupTasksList.length === 0) return null;
            return (
              <section key={key}>
                <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide opacity-60">
                  {GROUP_LABELS[key]}
                </h2>
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {groupTasksList.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={handleToggle}
                        onEdit={openEdit}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <motion.button
        type="button"
        aria-label="New task"
        onClick={openNew}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-xl shadow-indigo-500/30"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      {modalOpen && (
        <TaskCaptureModal
          key={editing?.id ?? "new"}
          open
          initial={editing}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          onCreateCategory={handleCreateCategory}
        />
      )}
    </div>
  );
}
```

> **Note (mount-per-open):** the modal is rendered only while `modalOpen` and is
> `key`ed by `editing?.id ?? "new"`, so it mounts fresh each time it opens and its
> `useState(initial?.…)` seeds re-run — this is what makes edit mode pre-fill and
> avoids stale form state when switching between tasks.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test "src/app/(app)/tasks/task-list.test.tsx"`
Expected: PASS — all four cases green.

- [ ] **Step 6: Full suite, typecheck, lint**

Run: `bun run test && bunx tsc --noEmit && bunx biome check .`
Expected: whole suite green; no type errors; Biome clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/tasks"
git commit -m "feat: add tasks page with grouped list and capture modal"
```

---

## Task 8: Feature documentation

**Files:**
- Create: `docs/tasks.md`

- [ ] **Step 1: Write the doc**

Create `docs/tasks.md`:

```markdown
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

## Out of scope (Phase 4)

- Subtasks (separate `subtasks` table + checklist UI).
- Recurrence engine — monthly/annually with an interval and a `lead_days` lead time;
  the next occurrence surfaces N days before its due date (config in `tasks.recurrence`).
- Filtering the list by category or tag.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tasks.md
git commit -m "docs: document tasks core feature"
```

---

## Phase 3 Done — Definition of Done

- [ ] `tasks` table exists (full, incl. `recurrence` + generated `search_vector`) with RLS + four owner-scoped policies; migration applied (or deferred + noted); RLS test passes or manually verified.
- [ ] `lib/tasks.ts` CRUD + `lib/task-groups.ts` grouping are unit-tested and green.
- [ ] `PriorityFlag`, `TaskCard`, `TaskCaptureModal` implemented and unit-tested.
- [ ] `/tasks` page guards auth, loads tasks + categories SSR, shows the grouped list + floating "+", and supports create-then-render add plus optimistic toggle/edit with toast rollback.
- [ ] Reuses Phase 2 `CategoryPicker` / `TagInput` / `GlassPanel` / `sonner` (no rebuilds).
- [ ] `docs/tasks.md` exists.
- [ ] Full verification green: `bun run test`, `bunx tsc --noEmit`, `bunx biome check .`.
- [ ] No subtasks, no recurrence logic, no filtering (correctly deferred to Phase 4).

## Notes for Later Phases

- **Recurrence (Phase 4):** user picks freq `monthly | yearly`, an `interval`, and `lead_days`; the next occurrence **surfaces `lead_days` before its due date** (not at completion). Needs a time-based generator (e.g. a Supabase `pg_cron` job that materializes the next instance when it enters the lead window) — design it in Phase 4. May add a series-link column to `tasks` then.
- **Subtasks (Phase 4):** a separate `subtasks` table (`task_id` FK `on delete cascade`, `title`, `is_done`, `position`) + an ordered checklist in the task card/detail.
- **Filtering (Phase 4):** hooks onto `tags` (GIN) + `category_id`, now that the list exists; the picker/tag components are ready.
- **Search (later):** the generated `search_vector` + GIN index are already in place.
