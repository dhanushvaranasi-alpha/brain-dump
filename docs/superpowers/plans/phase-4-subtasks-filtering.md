# brain-dump Phase 4: Subtasks & Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ordered **subtask checklists** to tasks (managed in the capture/edit modal, with a "done/total" badge on the task card) and a client-side **filter bar** on `/tasks` (single category + tags, matching all selected tags).

**Architecture:** A new `subtasks` table (owner-scoped via its parent task's RLS) with a `lib/subtasks.ts` data-access module and a pure `diffSubtasks` reconcile. The capture modal keeps its **presentational** contract: it holds subtasks as local `SubtaskItem[]` and passes them to `onSubmit(input, subtasks)`; the `TaskList` manager persists them (create-then-insert for new tasks, diff/apply for edits). Filtering is pure (`lib/task-filter.ts`), applied in the manager over the already-loaded list before the existing `groupTasks` runs. Reuses Phase 2/3 components and patterns directly.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4, `@supabase/ssr` + `@supabase/supabase-js`, `framer-motion`, `lucide-react`, `sonner`, Vitest + @testing-library/react + happy-dom, Biome. Package manager: **Bun**.

## Global Constraints

- Package manager is **Bun** — `bun add`, `bun add -d`, `bunx`. Never npm/pnpm.
- **Never run the dev server or a production build** to verify. Verify only with `bun run test`, `bunx tsc --noEmit`, `bunx biome check .` (auto-fix: `bunx biome check --write .`).
- Commit messages: short, conventional prefixes (`feat:`, `test:`, `docs:`). Never mention any AI assistant/model/vendor.
- **Multi-user, isolated spaces:** every table is owner-scoped by RLS. `subtasks` are scoped **through the parent task** (`task_id in (select id from public.tasks where user_id = auth.uid())`).
- Route-group paths contain `(app)` — **always quote** in shell commands: `bun run test "src/app/(app)/tasks/..."`, `git add "src/app/(app)/tasks"`.
- **Preserve existing behavior:** modifications to `TaskCard`, `TaskCaptureModal`, `TaskList`, and `page.tsx` must keep the Phase 3 tests green. New props are **optional with safe defaults** so existing call sites/tests don't break.
- Glassmorphism: reuse `GlassPanel` and existing glass utility classes; respect `prefers-reduced-motion`.
- **Out of scope for Phase 4 (do NOT build):** the recurrence engine (Phase 5), subtask drag-and-drop reordering (insertion order only), subtask rename (add/check/delete only), and server-side filtering.

---

## File Structure

```
brain-dump/
├── supabase/
│   ├── migrations/
│   │   └── 0004_subtasks.sql             # NEW: subtasks table + RLS (via parent task) + index
│   └── tests/
│       └── rls_subtasks.test.sql         # NEW: RLS enabled + anon-denied + cross-user isolation
├── src/
│   ├── app/(app)/tasks/
│   │   ├── page.tsx                      # MODIFY: also load subtasks (SSR)
│   │   ├── task-list.tsx                 # MODIFY: subtasks state + reconcile, filter bar, badges
│   │   └── task-list.test.tsx            # MODIFY: add filter + subtask-badge cases
│   ├── components/
│   │   ├── subtask-checklist.tsx         # NEW: presentational add/check/delete checklist
│   │   ├── subtask-checklist.test.tsx    # NEW
│   │   ├── task-filter-bar.tsx           # NEW: category + tags filter control
│   │   ├── task-filter-bar.test.tsx      # NEW
│   │   ├── task-card.tsx                 # MODIFY: add "done/total" subtask badge
│   │   ├── task-card.test.tsx            # MODIFY: add badge case
│   │   ├── task-capture-modal.tsx        # MODIFY: subtasks section; onSubmit(input, subtasks)
│   │   └── task-capture-modal.test.tsx   # MODIFY: update onSubmit assertion; add subtask case
│   └── lib/
│       ├── subtasks.ts                   # NEW: Subtask/SubtaskItem types + CRUD + diffSubtasks
│       ├── subtasks.test.ts              # NEW
│       ├── task-filter.ts               # NEW: pure filterTasks
│       └── task-filter.test.ts          # NEW
└── docs/
    └── tasks.md                          # MODIFY: document subtasks + filtering
```

**Interfaces exported by this phase:**

- `lib/subtasks.ts` → `Subtask`, `SubtaskItem`, `SubtaskInput` types; `listSubtasks`, `createSubtask`, `toggleSubtask`, `deleteSubtask`, `diffSubtasks`
- `lib/task-filter.ts` → `TaskFilter` type; `filterTasks(tasks, filter)`
- `components/subtask-checklist.tsx` → `SubtaskChecklist` (props: `items`, `onChange`)
- `components/task-filter-bar.tsx` → `TaskFilterBar` (props: `categories`, `allTags`, `value`, `onChange`)

**Reused from Phase 2/3 (do not rebuild):** `Task`/`TaskInput` from `lib/tasks`, `Category`/`createCategory` from `lib/categories`, `groupTasks`/`GROUP_ORDER`/`GROUP_LABELS`, `TaskCard`, `TaskCaptureModal`, `CategoryPicker`, `TagInput`, `GlassPanel`, `EmptyState`, `sonner`.

---

## Task 1: `subtasks` table migration + RLS + test

**Files:**
- Create: `supabase/migrations/0004_subtasks.sql`
- Create: `supabase/tests/rls_subtasks.test.sql`

**Interfaces:**
- Produces: `public.subtasks` (`id, task_id, title, is_done, position, created_at`); RLS enabled with four policies scoped through the parent task (`task_id in (select id from public.tasks where user_id = auth.uid())`); index on `task_id`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0004_subtasks.sql`:

```sql
-- subtasks: ordered checklist items belonging to a task. Owner-scoped through
-- the parent task's user_id (RLS), following the pattern of the other tables.
create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index subtasks_task_id_idx on public.subtasks (task_id);

alter table public.subtasks enable row level security;

-- Ownership is derived from the parent task. A subtask row is visible/mutable
-- only when its task belongs to the current user.
create policy "subtasks are viewable by task owner"
  on public.subtasks for select
  using (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );

create policy "subtasks are insertable by task owner"
  on public.subtasks for insert
  with check (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );

create policy "subtasks are updatable by task owner"
  on public.subtasks for update
  using (
    task_id in (select id from public.tasks where user_id = auth.uid())
  )
  with check (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );

create policy "subtasks are deletable by task owner"
  on public.subtasks for delete
  using (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );
```

- [ ] **Step 2: Write the RLS test**

Create `supabase/tests/rls_subtasks.test.sql`:

```sql
begin;
select plan(4);

-- RLS is enabled on subtasks
select ok(
  (select relrowsecurity from pg_class where oid = 'public.subtasks'::regclass),
  'RLS enabled on subtasks'
);

-- anon role cannot read subtasks
set local role anon;
select is_empty(
  'select 1 from public.subtasks',
  'anon sees no subtask rows'
);
reset role;

-- Seed two users, each with a task and one subtask, to prove cross-user isolation.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com');
insert into public.tasks (id, user_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'A task'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'B task');
insert into public.subtasks (task_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A subtask'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B subtask');

-- As user A: sees only their own subtask (via the parent task).
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*) from public.subtasks',
  ARRAY[1::bigint],
  'user A sees only their own subtask (cross-user isolation)'
);

-- As user A: cannot delete user B's subtask.
select is_empty(
  $$ delete from public.subtasks
     where task_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
     returning 1 $$,
  'user A cannot delete user B subtask'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Apply the migration**

Apply via `bunx supabase db reset` (local Docker), `bunx supabase db push` (linked CLI), or paste `0004_subtasks.sql` into the dashboard SQL Editor. Requires `0003_tasks.sql` applied first (`subtasks.task_id` → `tasks`).
Expected: `public.subtasks` exists with RLS enabled. (If no live DB in the environment, write + commit and defer application — note it in the report.)

- [ ] **Step 4: Verify RLS (if pgTAP / local DB available)**

Run: `bunx supabase test db`
Expected: `rls_subtasks.test.sql` passes 4/4. (If no local DB, verify table + policies in the dashboard.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_subtasks.sql supabase/tests/rls_subtasks.test.sql
git commit -m "feat: add subtasks table with owner-scoped RLS"
```

---

## Task 2: `lib/subtasks.ts` — data-access + reconcile

**Files:**
- Create: `src/lib/subtasks.ts`
- Test: `src/lib/subtasks.test.ts`

**Interfaces:**
- Consumes: a `SupabaseClient`.
- Produces:
  - `interface Subtask { id: string; task_id: string; title: string; is_done: boolean; position: number; created_at: string }`
  - `interface SubtaskItem { id?: string; title: string; is_done: boolean }` — the modal's working unit (persisted rows have an `id`, new drafts don't)
  - `interface SubtaskInput { task_id: string; title: string; position: number }`
  - `listSubtasks(supabase): Promise<Subtask[]>` — all of the user's subtasks (RLS-scoped), ordered by `position` ascending
  - `createSubtask(supabase, input: SubtaskInput): Promise<Subtask>`
  - `toggleSubtask(supabase, id: string, is_done: boolean): Promise<Subtask>`
  - `deleteSubtask(supabase, id: string): Promise<void>`
  - `diffSubtasks(original: Subtask[], current: SubtaskItem[]): { toCreate: { title: string; position: number }[]; toToggle: { id: string; is_done: boolean }[]; toDelete: string[] }` — pure. `toCreate` = current items without an `id`; `toDelete` = original ids absent from current; `toToggle` = current items whose `id` matches an original whose `is_done` changed.
  - Each async fn throws the Supabase error on failure.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/subtasks.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/lib/subtasks.test.ts`
Expected: FAIL — cannot import from `./subtasks`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/subtasks.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/subtasks.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check src/lib/subtasks.ts src/lib/subtasks.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/subtasks.ts src/lib/subtasks.test.ts
git commit -m "feat: add subtasks data-access and reconcile"
```

---

## Task 3: `lib/task-filter.ts` — pure filtering

**Files:**
- Create: `src/lib/task-filter.ts`
- Test: `src/lib/task-filter.test.ts`

**Interfaces:**
- Consumes: `Task` from `lib/tasks`.
- Produces:
  - `interface TaskFilter { categoryId: string | null; tags: string[] }`
  - `filterTasks(tasks: Task[], filter: TaskFilter): Task[]` — keeps a task when (`categoryId` is null OR `task.category_id === categoryId`) AND (every tag in `filter.tags` is present in `task.tags`). Empty filter returns all tasks.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/task-filter.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { Task } from "./tasks";
import { filterTasks } from "./task-filter";

function task(p: Partial<Task>): Task {
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
    ...p,
  };
}

describe("filterTasks", () => {
  const tasks = [
    task({ id: "a", category_id: "c1", tags: ["work", "urgent"] }),
    task({ id: "b", category_id: "c1", tags: ["work"] }),
    task({ id: "c", category_id: "c2", tags: ["home"] }),
  ];

  it("returns all tasks when the filter is empty", () => {
    const out = filterTasks(tasks, { categoryId: null, tags: [] });
    expect(out.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("filters by category", () => {
    const out = filterTasks(tasks, { categoryId: "c2", tags: [] });
    expect(out.map((t) => t.id)).toEqual(["c"]);
  });

  it("requires all selected tags (AND)", () => {
    const out = filterTasks(tasks, { categoryId: null, tags: ["work", "urgent"] });
    expect(out.map((t) => t.id)).toEqual(["a"]);
  });

  it("combines category and tags", () => {
    const out = filterTasks(tasks, { categoryId: "c1", tags: ["work"] });
    expect(out.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/lib/task-filter.test.ts`
Expected: FAIL — cannot import from `./task-filter`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/task-filter.ts`:

```typescript
import type { Task } from "./tasks";

export interface TaskFilter {
  categoryId: string | null;
  tags: string[];
}

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  return tasks.filter((task) => {
    if (filter.categoryId && task.category_id !== filter.categoryId) {
      return false;
    }
    return filter.tags.every((tag) => task.tags.includes(tag));
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/task-filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/task-filter.ts src/lib/task-filter.test.ts
git commit -m "feat: add pure task filtering by category and tags"
```

---

## Task 4: `SubtaskChecklist` component

**Files:**
- Create: `src/components/subtask-checklist.tsx`
- Test: `src/components/subtask-checklist.test.tsx`

**Interfaces:**
- Consumes: `SubtaskItem` from `lib/subtasks`.
- Produces: `SubtaskChecklist` — presentational. Props `{ items: SubtaskItem[]; onChange: (items: SubtaskItem[]) => void }`.
  - An add-row (text input + "Add" button) appends a new `{ title, is_done: false }` on submit (ignores blank; trims).
  - Each item: a checkbox toggling `is_done` (accessible name `Toggle ${title}`), the title (struck through when done), and a remove button (accessible name `Remove ${title}`).

- [ ] **Step 1: Write the failing tests**

Create `src/components/subtask-checklist.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SubtaskItem } from "@/lib/subtasks";
import { SubtaskChecklist } from "./subtask-checklist";

const ITEMS: SubtaskItem[] = [{ id: "s1", title: "Buy milk", is_done: false }];

describe("SubtaskChecklist", () => {
  it("adds a trimmed subtask", async () => {
    const onChange = vi.fn();
    render(<SubtaskChecklist items={[]} onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText(/add a subtask/i), "  Eggs  ");
    await userEvent.click(screen.getByRole("button", { name: /^add subtask$/i }));
    expect(onChange).toHaveBeenCalledWith([{ title: "Eggs", is_done: false }]);
  });

  it("toggles a subtask's done state", async () => {
    const onChange = vi.fn();
    render(<SubtaskChecklist items={ITEMS} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /toggle buy milk/i }));
    expect(onChange).toHaveBeenCalledWith([
      { id: "s1", title: "Buy milk", is_done: true },
    ]);
  });

  it("removes a subtask", async () => {
    const onChange = vi.fn();
    render(<SubtaskChecklist items={ITEMS} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /remove buy milk/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/subtask-checklist.test.tsx`
Expected: FAIL — `./subtask-checklist` has no `SubtaskChecklist` export.

- [ ] **Step 3: Write the implementation**

Create `src/components/subtask-checklist.tsx`:

```tsx
"use client";

import { Check, Plus, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import type { SubtaskItem } from "@/lib/subtasks";

interface SubtaskChecklistProps {
  items: SubtaskItem[];
  onChange: (items: SubtaskItem[]) => void;
}

export function SubtaskChecklist({ items, onChange }: SubtaskChecklistProps) {
  const [draft, setDraft] = useState("");

  function add() {
    const title = draft.trim();
    setDraft("");
    if (!title) return;
    onChange([...items, { title, is_done: false }]);
  }

  function toggle(index: number) {
    onChange(
      items.map((s, i) => (i === index ? { ...s, is_done: !s.is_done } : s)),
    );
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li
            key={item.id ?? `new-${index}`}
            className="flex items-center gap-2 text-sm"
          >
            <button
              type="button"
              aria-label={`Toggle ${item.title}`}
              onClick={() => toggle(index)}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                item.is_done
                  ? "border-emerald-400 bg-emerald-500/80 text-white"
                  : "border-white/40 hover:border-white/70"
              }`}
            >
              {item.is_done && <Check className="h-3 w-3" />}
            </button>
            <span className={`flex-1 ${item.is_done ? "line-through opacity-60" : ""}`}>
              {item.title}
            </span>
            <button
              type="button"
              aria-label={`Remove ${item.title}`}
              onClick={() => remove(index)}
              className="rounded opacity-70 transition hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a subtask…"
          className="flex-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="button"
          aria-label="Add subtask"
          onClick={add}
          className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-sm hover:bg-white/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/components/subtask-checklist.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check src/components/subtask-checklist.tsx src/components/subtask-checklist.test.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/subtask-checklist.tsx src/components/subtask-checklist.test.tsx
git commit -m "feat: add subtask checklist component"
```

---

## Task 5: `TaskFilterBar` component

**Files:**
- Create: `src/components/task-filter-bar.tsx`
- Test: `src/components/task-filter-bar.test.tsx`

**Interfaces:**
- Consumes: `Category` from `lib/categories`; `TaskFilter` from `lib/task-filter`.
- Produces: `TaskFilterBar` — props `{ categories: Category[]; allTags: string[]; value: TaskFilter; onChange: (filter: TaskFilter) => void }`.
  - A category `<select>` (accessible name "Filter by category"; "" option = All → `categoryId: null`).
  - A tag toggle per `allTags` entry (accessible name `Filter tag ${tag}`, `aria-pressed`); clicking adds/removes it from `value.tags`.
  - Renders nothing (returns `null`) when there are no categories and no tags.

- [ ] **Step 1: Write the failing tests**

Create `src/components/task-filter-bar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";
import type { TaskFilter } from "@/lib/task-filter";
import { TaskFilterBar } from "./task-filter-bar";

const CATS: Category[] = [
  { id: "c1", user_id: "u", name: "Work", color: "#6366f1", created_at: "" },
];
const EMPTY: TaskFilter = { categoryId: null, tags: [] };

describe("TaskFilterBar", () => {
  it("selects a category", async () => {
    const onChange = vi.fn();
    render(
      <TaskFilterBar
        categories={CATS}
        allTags={["work"]}
        value={EMPTY}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /filter by category/i }),
      "c1",
    );
    expect(onChange).toHaveBeenCalledWith({ categoryId: "c1", tags: [] });
  });

  it("toggles a tag on", async () => {
    const onChange = vi.fn();
    render(
      <TaskFilterBar
        categories={CATS}
        allTags={["work"]}
        value={EMPTY}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /filter tag work/i }));
    expect(onChange).toHaveBeenCalledWith({ categoryId: null, tags: ["work"] });
  });

  it("renders nothing when there is nothing to filter", () => {
    const { container } = render(
      <TaskFilterBar
        categories={[]}
        allTags={[]}
        value={EMPTY}
        onChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/task-filter-bar.test.tsx`
Expected: FAIL — `./task-filter-bar` has no `TaskFilterBar` export.

- [ ] **Step 3: Write the implementation**

Create `src/components/task-filter-bar.tsx`:

```tsx
"use client";

import type { Category } from "@/lib/categories";
import type { TaskFilter } from "@/lib/task-filter";

interface TaskFilterBarProps {
  categories: Category[];
  allTags: string[];
  value: TaskFilter;
  onChange: (filter: TaskFilter) => void;
}

export function TaskFilterBar({
  categories,
  allTags,
  value,
  onChange,
}: TaskFilterBarProps) {
  if (categories.length === 0 && allTags.length === 0) return null;

  function toggleTag(tag: string) {
    const tags = value.tags.includes(tag)
      ? value.tags.filter((t) => t !== tag)
      : [...value.tags, tag];
    onChange({ ...value, tags });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 backdrop-blur">
      {categories.length > 0 && (
        <select
          aria-label="Filter by category"
          value={value.categoryId ?? ""}
          onChange={(e) =>
            onChange({ ...value, categoryId: e.target.value || null })
          }
          className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {allTags.map((tag) => {
        const active = value.tags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-label={`Filter tag ${tag}`}
            aria-pressed={active}
            onClick={() => toggleTag(tag)}
            className={`rounded-full px-2.5 py-1 text-sm transition ${
              active ? "bg-indigo-500/70 text-white" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/components/task-filter-bar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check src/components/task-filter-bar.tsx src/components/task-filter-bar.test.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/task-filter-bar.tsx src/components/task-filter-bar.test.tsx
git commit -m "feat: add task filter bar component"
```

---

## Task 6: `TaskCard` — subtask progress badge

**Files:**
- Modify: `src/components/task-card.tsx`
- Modify: `src/components/task-card.test.tsx`

**Interfaces:**
- Consumes: (unchanged) `Task`, `PriorityFlag`.
- Produces: `TaskCard` with two **new optional** props `{ subtaskDone?: number; subtaskTotal?: number }` (default 0). When `subtaskTotal > 0`, renders a badge with text `${subtaskDone}/${subtaskTotal}` and `aria-label={`${subtaskDone} of ${subtaskTotal} subtasks done`}`. Existing props/behavior unchanged.

- [ ] **Step 1: Add the failing badge test**

Add this case to `src/components/task-card.test.tsx` (inside the existing `describe("TaskCard", …)` block, after the last test):

```tsx
  it("shows a subtask progress badge when the task has subtasks", () => {
    render(
      <TaskCard
        task={task({})}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        subtaskDone={2}
        subtaskTotal={5}
      />,
    );
    expect(screen.getByLabelText(/2 of 5 subtasks done/i)).toHaveTextContent("2/5");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/components/task-card.test.tsx`
Expected: FAIL — no element with that label (badge not implemented).

- [ ] **Step 3: Update the implementation**

Replace the whole contents of `src/components/task-card.tsx` with:

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
  subtaskDone?: number;
  subtaskTotal?: number;
}

export function TaskCard({
  task,
  onToggle,
  onEdit,
  subtaskDone = 0,
  subtaskTotal = 0,
}: TaskCardProps) {
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
        <span
          className={`flex-1 text-sm ${done ? "line-through opacity-60" : ""}`}
        >
          {task.title}
        </span>
        {subtaskTotal > 0 && (
          <span
            aria-label={`${subtaskDone} of ${subtaskTotal} subtasks done`}
            className="rounded-full bg-white/10 px-2 py-0.5 text-xs opacity-80"
          >
            {subtaskDone}/{subtaskTotal}
          </span>
        )}
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
Expected: PASS — the pre-existing cases plus the new badge case.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check src/components/task-card.tsx src/components/task-card.test.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/task-card.tsx src/components/task-card.test.tsx
git commit -m "feat: add subtask progress badge to task card"
```

---

## Task 7: `TaskCaptureModal` — subtasks section

**Files:**
- Modify: `src/components/task-capture-modal.tsx`
- Modify: `src/components/task-capture-modal.test.tsx`

**Interfaces:**
- Consumes: (adds) `SubtaskItem` from `lib/subtasks`; `SubtaskChecklist`.
- Produces: `TaskCaptureModal` with a **new optional** prop `initialSubtasks?: SubtaskItem[]` (default `[]`) and a **changed `onSubmit` signature**: `onSubmit: (input: TaskInput, subtasks: SubtaskItem[]) => Promise<void>`. Adds a "Subtasks" section rendering `SubtaskChecklist` over local `subtasks` state (seeded from `initialSubtasks`). On submit, calls `onSubmit(input, subtasks)` then `onClose`. All other behavior unchanged.

- [ ] **Step 1: Update the tests (edit existing, add new)**

In `src/components/task-capture-modal.test.tsx`, update the "submits a new task" assertion to the new two-arg signature and add a subtask case. Replace the existing `it("submits a new task with a title and due date", …)` test with:

```tsx
  it("submits a new task with a title, due date, and subtasks", async () => {
    const props = baseProps();
    render(<TaskCaptureModal {...props} />);
    await userEvent.type(screen.getByLabelText(/title/i), "Buy milk");
    fireEvent.change(screen.getByLabelText(/due date/i), {
      target: { value: "2026-07-15" },
    });
    await userEvent.type(
      screen.getByPlaceholderText(/add a subtask/i),
      "Get almond",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add subtask$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Buy milk",
        due_at: "2026-07-15T00:00:00.000Z",
      }),
      [{ title: "Get almond", is_done: false }],
    );
    expect(props.onClose).toHaveBeenCalled();
  });

  it("pre-fills subtasks in edit mode", () => {
    render(
      <TaskCaptureModal
        {...baseProps()}
        initialSubtasks={[{ id: "s1", title: "Existing sub", is_done: false }]}
      />,
    );
    expect(screen.getByText("Existing sub")).toBeInTheDocument();
  });
```

(The other three existing cases — renders-nothing-when-closed, pre-fills edit mode, disables-save-when-empty — stay as-is.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/task-capture-modal.test.tsx`
Expected: FAIL — `onSubmit` isn't called with the subtasks arg / no subtask input rendered.

- [ ] **Step 3: Update the implementation**

Replace the whole contents of `src/components/task-capture-modal.tsx` with:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Category } from "@/lib/categories";
import type { SubtaskItem } from "@/lib/subtasks";
import type { Priority, Task, TaskInput } from "@/lib/tasks";
import { CategoryPicker } from "./category-picker";
import { GlassPanel } from "./glass-panel";
import { SubtaskChecklist } from "./subtask-checklist";
import { TagInput } from "./tag-input";

const PRIORITIES: Priority[] = ["none", "low", "med", "high"];

interface TaskCaptureModalProps {
  open: boolean;
  initial?: Task | null;
  initialSubtasks?: SubtaskItem[];
  categories: Category[];
  onClose: () => void;
  onSubmit: (input: TaskInput, subtasks: SubtaskItem[]) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category>;
}

export function TaskCaptureModal({
  open,
  initial,
  initialSubtasks = [],
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
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>(initialSubtasks);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const canSave = title.trim().length > 0 && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit(
        {
          title: title.trim(),
          description: description.trim() || null,
          category_id: categoryId,
          tags,
          priority,
          due_at: dueDate ? `${dueDate}T00:00:00.000Z` : null,
        },
        subtasks,
      );
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
                      priority === p
                        ? "bg-white/20"
                        : "bg-white/5 hover:bg-white/10"
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

              <span className="block text-sm font-medium">Subtasks</span>
              <SubtaskChecklist items={subtasks} onChange={setSubtasks} />

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
Expected: PASS — all five cases green.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check src/components/task-capture-modal.tsx src/components/task-capture-modal.test.tsx`
Expected: clean. (`TaskList` still passes its one-arg `handleSubmit`, which stays assignable to the new two-arg `onSubmit` type — a function taking fewer params is assignable — so the whole project still typechecks; Task 8 wires the subtasks through.)

- [ ] **Step 6: Commit**

```bash
git add src/components/task-capture-modal.tsx src/components/task-capture-modal.test.tsx
git commit -m "feat: add subtasks section to task capture modal"
```

---

## Task 8: `/tasks` page + `TaskList` — load subtasks, filter, reconcile

**Files:**
- Modify: `src/app/(app)/tasks/page.tsx`
- Modify: `src/app/(app)/tasks/task-list.tsx`
- Modify: `src/app/(app)/tasks/task-list.test.tsx`

**Interfaces:**
- Consumes: `listSubtasks`, `createSubtask`, `toggleSubtask`, `deleteSubtask`, `diffSubtasks`, `Subtask`, `SubtaskItem` from `lib/subtasks`; `filterTasks`, `TaskFilter` from `lib/task-filter`; `TaskFilterBar`; the updated `TaskCard` (badge props) and `TaskCaptureModal` (`initialSubtasks`, two-arg `onSubmit`).
- Produces: `/tasks` with a filter bar, subtask badges on cards, and subtask persistence on save (create-then-insert for new tasks; `diffSubtasks` apply for edits). `TaskList` gains a **new optional** prop `initialSubtasks?: Subtask[]` (default `[]`).

- [ ] **Step 1: Update the page to load subtasks**

Replace the whole contents of `src/app/(app)/tasks/page.tsx` with:

```tsx
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
```

- [ ] **Step 2: Update the manager test (edit existing, add cases)**

In `src/app/(app)/tasks/task-list.test.tsx`, add these two cases inside the `describe("TaskList", …)` block. (No new module mock is needed: neither case triggers subtask persistence, so `@/lib/subtasks` runs unmocked — its functions are simply never called here. Subtask CRUD and `diffSubtasks` are covered by `src/lib/subtasks.test.ts`.)

```tsx
  it("shows a subtask progress badge on a task's card", () => {
    render(
      <TaskList
        initialTasks={[task({ id: "t1" })]}
        categories={CATS}
        initialSubtasks={[
          {
            id: "s1",
            task_id: "t1",
            title: "sub",
            is_done: true,
            position: 0,
            created_at: "",
          },
          {
            id: "s2",
            task_id: "t1",
            title: "sub2",
            is_done: false,
            position: 1,
            created_at: "",
          },
        ]}
      />,
    );
    expect(screen.getByLabelText(/1 of 2 subtasks done/i)).toBeInTheDocument();
  });

  it("filters the list by tag", async () => {
    render(
      <TaskList
        initialTasks={[
          task({ id: "t1", title: "Work task", tags: ["work"] }),
          task({ id: "t2", title: "Home task", tags: ["home"] }),
        ]}
        categories={CATS}
      />,
    );
    expect(screen.getByText("Home task")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /filter tag work/i }));
    expect(screen.queryByText("Home task")).not.toBeInTheDocument();
    expect(screen.getByText("Work task")).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test "src/app/(app)/tasks/task-list.test.tsx"`
Expected: FAIL — no badge / no filter control yet.

- [ ] **Step 4: Update the manager**

Replace the whole contents of `src/app/(app)/tasks/task-list.tsx` with:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TaskCaptureModal } from "@/components/task-capture-modal";
import { TaskCard } from "@/components/task-card";
import { TaskFilterBar } from "@/components/task-filter-bar";
import { type Category, createCategory } from "@/lib/categories";
import {
  createSubtask,
  deleteSubtask,
  diffSubtasks,
  type Subtask,
  type SubtaskItem,
  toggleSubtask,
} from "@/lib/subtasks";
import { createClient } from "@/lib/supabase/client";
import { GROUP_LABELS, GROUP_ORDER, groupTasks } from "@/lib/task-groups";
import { filterTasks, type TaskFilter } from "@/lib/task-filter";
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

const EMPTY_FILTER: TaskFilter = { categoryId: null, tags: [] };

export function TaskList({
  initialTasks,
  categories,
  initialSubtasks = [],
}: {
  initialTasks: Task[];
  categories: Category[];
  initialSubtasks?: Subtask[];
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks);
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const groups = groupTasks(filterTasks(tasks, filter), todayKey());
  const allTags = [...new Set(tasks.flatMap((t) => t.tags))].sort();

  function subtasksFor(taskId: string): Subtask[] {
    return subtasks.filter((s) => s.task_id === taskId);
  }

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(task: Task) {
    setEditing(task);
    setModalOpen(true);
  }

  async function persistSubtasks(taskId: string, submitted: SubtaskItem[]) {
    const original = subtasksFor(taskId);
    const { toCreate, toToggle, toDelete } = diffSubtasks(original, submitted);
    const created = await Promise.all(
      toCreate.map((s) =>
        createSubtask(supabase, {
          task_id: taskId,
          title: s.title,
          position: s.position,
        }),
      ),
    );
    await Promise.all(toToggle.map((s) => toggleSubtask(supabase, s.id, s.is_done)));
    await Promise.all(toDelete.map((id) => deleteSubtask(supabase, id)));
    setSubtasks((prev) => {
      const kept = prev.filter(
        (s) => s.task_id !== taskId || !toDelete.includes(s.id),
      );
      const toggled = kept.map((s) => {
        const t = toToggle.find((x) => x.id === s.id);
        return t ? { ...s, is_done: t.is_done } : s;
      });
      return [...toggled, ...created];
    });
  }

  async function handleSubmit(input: TaskInput, submittedSubtasks: SubtaskItem[]) {
    if (editing) {
      const prev = tasks;
      const target = editing;
      setTasks((ts) =>
        ts.map((t) => (t.id === target.id ? { ...t, ...input } : t)),
      );
      try {
        const saved = await updateTask(supabase, target.id, input);
        setTasks((ts) => ts.map((t) => (t.id === saved.id ? saved : t)));
        await persistSubtasks(target.id, submittedSubtasks);
      } catch {
        setTasks(prev);
        toast.error("Could not save task");
      }
    } else {
      try {
        const created = await createTask(supabase, input);
        setTasks((ts) => [created, ...ts]);
        await persistSubtasks(created.id, submittedSubtasks);
      } catch {
        toast.error("Could not add task");
      }
    }
  }

  async function handleToggle(task: Task) {
    const done = task.status !== "done";
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) =>
        t.id === task.id ? { ...t, status: done ? "done" : "todo" } : t,
      ),
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

  const editingSubtasks: SubtaskItem[] = editing
    ? subtasksFor(editing.id).map((s) => ({
        id: s.id,
        title: s.title,
        is_done: s.is_done,
      }))
    : [];

  return (
    <div className="space-y-4">
      <TaskFilterBar
        categories={categories}
        allTags={allTags}
        value={filter}
        onChange={setFilter}
      />

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
                    {groupTasksList.map((task) => {
                      const subs = subtasksFor(task.id);
                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={handleToggle}
                          onEdit={openEdit}
                          subtaskDone={subs.filter((s) => s.is_done).length}
                          subtaskTotal={subs.length}
                        />
                      );
                    })}
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
          initialSubtasks={editingSubtasks}
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

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test "src/app/(app)/tasks/task-list.test.tsx"`
Expected: PASS — pre-existing cases plus the new badge + filter cases.

- [ ] **Step 6: Full suite, typecheck, lint**

Run: `bun run test && bunx tsc --noEmit && bunx biome check .`
Expected: whole suite green; no type errors; Biome clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/tasks"
git commit -m "feat: wire subtasks and filtering into the tasks list"
```

---

## Task 9: Documentation update

**Files:**
- Modify: `docs/tasks.md`

- [ ] **Step 1: Update the doc**

Add these two sections to `docs/tasks.md` (before the "## Out of scope (Phase 4)" heading), and update that heading to reflect what shipped:

```markdown
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
```

Then change the final heading from `## Out of scope (Phase 4)` to `## Out of scope (Phase 5)` and keep only the recurrence bullet (subtasks + filtering are now implemented).

- [ ] **Step 2: Commit**

```bash
git add docs/tasks.md
git commit -m "docs: document subtasks and filtering"
```

---

## Phase 4 Done — Definition of Done

- [ ] `subtasks` table exists (owner-scoped via parent task) with RLS + four policies; migration applied (or deferred + noted); RLS test passes or manually verified.
- [ ] `lib/subtasks.ts` (CRUD + `diffSubtasks`) and `lib/task-filter.ts` (`filterTasks`) are unit-tested and green.
- [ ] `SubtaskChecklist` and `TaskFilterBar` implemented and unit-tested.
- [ ] `TaskCard` shows a subtask badge; `TaskCaptureModal` has a subtasks section and the two-arg `onSubmit`; both keep their Phase 3 tests green.
- [ ] `/tasks` page loads subtasks SSR; `TaskList` applies the filter before grouping, shows badges, and persists subtasks on save (create-then-insert / diff-apply).
- [ ] Reuses Phase 2/3 components (no rebuilds); new props are optional with safe defaults.
- [ ] `docs/tasks.md` updated.
- [ ] Full verification green: `bun run test`, `bunx tsc --noEmit`, `bunx biome check .`.
- [ ] No recurrence engine, no drag reorder, no subtask rename, no server-side filtering (correctly deferred).

## Notes for Later Phases

- **Recurrence (Phase 5):** freq `monthly | yearly` + `interval` + `lead_days`; the next occurrence surfaces `lead_days` before its due date (not at completion) — needs a time-based generator (e.g. Supabase `pg_cron`). Config in `tasks.recurrence` jsonb.
- **Subtask reordering** (drag-and-drop) and **rename** were deferred; the `position` column already supports ordering if reorder is added later.
- **Notes** (Phase 6) and **Search** (the `search_vector` columns already exist) remain.
