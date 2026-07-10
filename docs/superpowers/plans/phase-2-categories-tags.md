# brain-dump Phase 2: Categories & Tags — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared-categories foundation — a `categories` table with owner-scoped RLS, a typed data-access module, a Google-Keep-labels-style `/categories` management page (inline add / rename / recolor / delete with optimistic updates), plus two reusable presentational components (`CategoryPicker` with create-on-type, and a chip-style `TagInput`) that Phases 3–4 will drop into Tasks and Notes.

**Architecture:** A new `categories` Postgres table follows the exact RLS pattern established by `profiles` in Phase 1 (`auth.uid() = user_id`, with `user_id` defaulting to `auth.uid()` so inserts need no explicit owner). A framework-agnostic data-access module (`lib/categories.ts`) wraps all CRUD and takes a Supabase client as a parameter, so the same functions run against the server client (initial SSR load + auth guard) and the browser client (optimistic client-side mutations). The `/categories` page is a server component that guards auth and loads the initial list, then hands off to a client `CategoryManager` that owns optimistic state and calls the data-access functions via the browser client. Toasts (via `sonner`) surface mutation errors and rollbacks. `CategoryPicker` and `TagInput` are pure presentational components with no data dependency.

**Tech Stack:** Next.js 16 (App Router, server + client components), TypeScript, Tailwind CSS v4, `@supabase/ssr` + `@supabase/supabase-js`, `framer-motion` (motion, already used), `lucide-react` (icons, already installed), `sonner` (toasts — **new** runtime dependency added in Task 3), Vitest + @testing-library/react + happy-dom, Biome. Package manager: **Bun**.

## Global Constraints

- Package manager is **Bun** — use `bun add`, `bun add -d`, `bunx`. Never use npm/pnpm.
- **Never run the dev server or a production build** as a verification step. Verify only with `bun run test` (Vitest), `bunx tsc --noEmit` (typecheck), and `bunx biome check .` (lint/format; auto-fix with `bunx biome check --write .`).
- Commit messages: short, conventional-commit prefixes (`feat:`, `chore:`, `test:`, `docs:`). Never mention any AI assistant/model/vendor in commits or code.
- **Multi-user, isolated spaces:** the app serves many users, each seeing only their own data. Every DB table is scoped to the authenticated user and protected by RLS (`auth.uid() = user_id`) — this owner-scoping *is* the per-user isolation boundary. Categories are per-user (the `(user_id, lower(name))` unique index means two different users can each have a "Work" category). Cross-user sharing/collaboration is **out of scope (v2)** — do not add shared/workspace tables or share-aware policies here.
- Supabase env vars already exist in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Glassmorphism aesthetic: frosted translucent surfaces (`backdrop-blur`), light + dark, respect `prefers-reduced-motion`. Reuse the existing glass utility patterns (`border border-white/20 bg-white/10 backdrop-blur-2xl shadow-xl`) and the `GlassPanel` component.
- **Out of scope for Phase 2 (do NOT build):** filtering by category/tag (needs the Tasks/Notes lists from Phases 3–4), the `tasks`/`notes`/`subtasks` tables, and any capture modal. Tags get only a reusable input component here — no `tasks`/`notes` rows exist to attach them to yet.

---

## File Structure

```
brain-dump/
├── supabase/
│   ├── migrations/
│   │   └── 0002_categories.sql          # NEW: categories table + RLS + indexes
│   └── tests/
│       └── rls_categories.test.sql      # NEW: RLS enabled + anon-denied checks
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # MODIFY: mount <Toaster /> (sonner)
│   │   └── (app)/
│   │       ├── layout.tsx               # MODIFY: add "Categories" header link
│   │       └── categories/
│   │           ├── page.tsx             # NEW: server component — auth guard + initial load
│   │           └── category-manager.tsx # NEW: client — optimistic CRUD list UI
│   ├── components/
│   │   ├── color-swatch.tsx             # NEW: single selectable color dot
│   │   ├── color-swatch.test.tsx        # NEW
│   │   ├── tag-input.tsx                # NEW: reusable chip input over string[]
│   │   ├── tag-input.test.tsx           # NEW
│   │   ├── category-picker.tsx          # NEW: reusable select + create-on-type
│   │   └── category-picker.test.tsx     # NEW
│   └── lib/
│       ├── category-colors.ts           # NEW: preset palette + default color
│       ├── categories.ts                # NEW: Category type + CRUD data-access
│       └── categories.test.ts           # NEW: unit tests (mocked Supabase client)
└── docs/
    └── categories.md                    # NEW: feature doc (docs/ convention)
```

**Interfaces exported by this phase (consumed by Phases 3–4):**

- `lib/category-colors.ts` → `CATEGORY_COLORS: readonly string[]`, `DEFAULT_CATEGORY_COLOR: string`
- `lib/categories.ts` → `Category`, `CategoryInput` types; `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`
- `components/category-picker.tsx` → `CategoryPicker` (props: `categories`, `value`, `onChange`, `onCreate`)
- `components/tag-input.tsx` → `TagInput` (props: `value`, `onChange`)

---

## Task 1: `categories` table migration + RLS + RLS test

**Files:**
- Create: `supabase/migrations/0002_categories.sql`
- Create: `supabase/tests/rls_categories.test.sql`

**Interfaces:**
- Produces: a `public.categories` table (`id`, `user_id`, `name`, `color`, `created_at`) with RLS enabled and owner-scoped SELECT/INSERT/UPDATE/DELETE policies; `user_id` defaults to `auth.uid()`. A case-insensitive unique index on `(user_id, lower(name))` prevents duplicate category names per user (backs "create-on-type" idempotency).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_categories.sql`:

```sql
-- categories: user-managed labels shared across tasks and notes.
-- Follows the profiles RLS pattern from 0001. user_id defaults to auth.uid()
-- so inserts from the client never need to pass an explicit owner.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- One category name per user, case-insensitive. Makes "create-on-type" safe:
-- typing an existing name (any casing) collides instead of duplicating.
create unique index categories_user_name_unique
  on public.categories (user_id, lower(name));

-- List queries scope by user_id (RLS) and order by name.
create index categories_user_id_idx on public.categories (user_id);

alter table public.categories enable row level security;

create policy "categories are viewable by owner"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "categories are insertable by owner"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "categories are updatable by owner"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories are deletable by owner"
  on public.categories for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Write the RLS test**

Create `supabase/tests/rls_categories.test.sql` (mirrors `rls_profiles.test.sql`):

```sql
begin;
select plan(2);

-- RLS is enabled on categories
select ok(
  (select relrowsecurity from pg_class where oid = 'public.categories'::regclass),
  'RLS enabled on categories'
);

-- anon role cannot read categories (no rows visible without auth.uid())
set local role anon;
select is_empty(
  'select 1 from public.categories',
  'anon sees no category rows'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Apply the migration**

Apply it using whichever path is available (see the Phase 2 handoff notes, §"Applying the migration"):
- **Docker (local Supabase):** `bunx supabase db reset` (re-runs all migrations), or
- **Cloud CLI:** `bunx supabase db push`, or
- **Manual fallback:** paste `supabase/migrations/0002_categories.sql` into the Supabase dashboard → SQL Editor → Run.

Expected: table `public.categories` exists with RLS enabled; no SQL errors.

- [ ] **Step 4: Verify RLS (if pgTAP / local DB available)**

If running local Supabase with pgTAP: `bunx supabase test db`.
Expected: `rls_categories.test.sql` passes 2/2. (If no local DB, verify manually in the dashboard: the table shows a shield/RLS-enabled badge and four policies.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_categories.sql supabase/tests/rls_categories.test.sql
git commit -m "feat: add categories table with owner-scoped RLS"
```

---

## Task 2: `lib/category-colors.ts` — preset palette

**Files:**
- Create: `src/lib/category-colors.ts`

**Interfaces:**
- Produces: `CATEGORY_COLORS` (a readonly array of 8 hex strings) and `DEFAULT_CATEGORY_COLOR` (the first color, matching the DB default `#6366f1`). Consumed by `ColorSwatch`, `CategoryManager`, and later the item cards.

- [ ] **Step 1: Write the palette module**

Create `src/lib/category-colors.ts`:

```typescript
// Preset category colors — glass-friendly, readable in light and dark.
// The first entry matches the DB column default in 0002_categories.sql.
export const CATEGORY_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#64748b", // slate
] as const;

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0];
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/category-colors.ts
git commit -m "feat: add category color palette"
```

---

## Task 3: Toast infrastructure (`sonner`)

**Files:**
- Modify: `src/app/layout.tsx` (mount `<Toaster />`)
- Add dependency: `sonner`

**Interfaces:**
- Produces: a globally mounted toast portal. Any client component can `import { toast } from "sonner"` and call `toast.error(...)` / `toast.success(...)`. Used by `CategoryManager` (Task 7) and every later phase.

- [ ] **Step 1: Add the dependency (runtime, not dev)**

```bash
bun add sonner
```

Expected: `sonner` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Mount the Toaster in the root layout**

Modify `src/app/layout.tsx` — import `Toaster` from `sonner` and render it inside `ThemeProvider`, after `{children}`. The `theme="system"` + `richColors` props keep it consistent with the app's theming:

```tsx
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "brain-dump",
  description: "Fast capture for tasks and notes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <Toaster theme="system" richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check .`
Expected: no type errors; Biome clean (auto-fix with `bunx biome check --write .` if needed).

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock src/app/layout.tsx
git commit -m "feat: add sonner toast provider"
```

---

## Task 4: `lib/categories.ts` — data-access module

**Files:**
- Create: `src/lib/categories.ts`
- Test: `src/lib/categories.test.ts`

**Interfaces:**
- Consumes: a `SupabaseClient` from `@supabase/supabase-js` (either the browser client from `lib/supabase/client.ts` or the server client from `lib/supabase/server.ts`).
- Produces:
  - `interface Category { id: string; user_id: string; name: string; color: string; created_at: string }`
  - `interface CategoryInput { name: string; color: string }`
  - `listCategories(supabase): Promise<Category[]>` — ordered by `name` ascending
  - `createCategory(supabase, input: CategoryInput): Promise<Category>` — trims name; `user_id` filled by DB default
  - `updateCategory(supabase, id: string, input: Partial<CategoryInput>): Promise<Category>` — trims name when present
  - `deleteCategory(supabase, id: string): Promise<void>`
  - Each throws the Supabase error on failure.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/categories.test.ts`. The mock builder is **thenable** (has a `then`), so `await`-ing it at any point in the chain resolves to `result` — this matches how the Supabase query builder terminates at different methods (`.order()`, `.single()`, `.eq()`):

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "./categories";

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

describe("listCategories", () => {
  it("selects all categories ordered by name and returns rows", async () => {
    const rows = [{ id: "1", name: "Work" }];
    const { client, from, builder } = mockSupabase({ data: rows, error: null });
    const result = await listCategories(client);
    expect(from).toHaveBeenCalledWith("categories");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(result).toEqual(rows);
  });

  it("returns [] when data is null", async () => {
    const { client } = mockSupabase({ data: null, error: null });
    expect(await listCategories(client)).toEqual([]);
  });

  it("throws when Supabase returns an error", async () => {
    const { client } = mockSupabase({ data: null, error: new Error("boom") });
    await expect(listCategories(client)).rejects.toThrow("boom");
  });
});

describe("createCategory", () => {
  it("inserts a trimmed name with the given color and returns the row", async () => {
    const row = { id: "1", name: "Work", color: "#6366f1" };
    const { client, builder } = mockSupabase({ data: row, error: null });
    const result = await createCategory(client, {
      name: "  Work  ",
      color: "#6366f1",
    });
    expect(builder.insert).toHaveBeenCalledWith({
      name: "Work",
      color: "#6366f1",
    });
    expect(result).toEqual(row);
  });
});

describe("updateCategory", () => {
  it("updates only provided fields, trims name, and returns the row", async () => {
    const row = { id: "1", name: "Home", color: "#10b981" };
    const { client, builder } = mockSupabase({ data: row, error: null });
    const result = await updateCategory(client, "1", { name: " Home " });
    expect(builder.update).toHaveBeenCalledWith({ name: "Home" });
    expect(builder.eq).toHaveBeenCalledWith("id", "1");
    expect(result).toEqual(row);
  });
});

describe("deleteCategory", () => {
  it("deletes by id and resolves", async () => {
    const { client, builder } = mockSupabase({ data: null, error: null });
    await deleteCategory(client, "1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "1");
  });

  it("throws when Supabase returns an error", async () => {
    const { client } = mockSupabase({ data: null, error: new Error("nope") });
    await expect(deleteCategory(client, "1")).rejects.toThrow("nope");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/lib/categories.test.ts`
Expected: FAIL — cannot import from `./categories` (module/exports don't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/categories.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/categories.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check .`
Expected: no type errors; Biome clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "feat: add categories data-access module"
```

---

## Task 5: `ColorSwatch` component

**Files:**
- Create: `src/components/color-swatch.tsx`
- Test: `src/components/color-swatch.test.tsx`

**Interfaces:**
- Produces: `ColorSwatch` — a single selectable color dot.
  - Props: `color: string`, `selected: boolean`, `onSelect: (color: string) => void`.
  - Renders a `button` with `aria-label={`Color ${color}`}` and `aria-pressed={selected}`; background is the color; shows a ring when selected.

- [ ] **Step 1: Write the failing test**

Create `src/components/color-swatch.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ColorSwatch } from "./color-swatch";

describe("ColorSwatch", () => {
  it("exposes color via aria-label and pressed state", () => {
    render(<ColorSwatch color="#ef4444" selected onSelect={() => {}} />);
    const btn = screen.getByRole("button", { name: /color #ef4444/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onSelect with its color when clicked", async () => {
    const onSelect = vi.fn();
    render(<ColorSwatch color="#10b981" selected={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /color #10b981/i }));
    expect(onSelect).toHaveBeenCalledWith("#10b981");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/components/color-swatch.test.tsx`
Expected: FAIL — `./color-swatch` has no `ColorSwatch` export.

- [ ] **Step 3: Write the implementation**

Create `src/components/color-swatch.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";

interface ColorSwatchProps {
  color: string;
  selected: boolean;
  onSelect: (color: string) => void;
}

export function ColorSwatch({ color, selected, onSelect }: ColorSwatchProps) {
  return (
    <motion.button
      type="button"
      aria-label={`Color ${color}`}
      aria-pressed={selected}
      onClick={() => onSelect(color)}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      style={{ backgroundColor: color }}
      className={`h-6 w-6 rounded-full transition-shadow ${
        selected
          ? "ring-2 ring-white ring-offset-2 ring-offset-transparent shadow-lg"
          : "opacity-80 hover:opacity-100"
      }`}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/components/color-swatch.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/color-swatch.tsx src/components/color-swatch.test.tsx
git commit -m "feat: add color swatch component"
```

---

## Task 6: `TagInput` reusable component

**Files:**
- Create: `src/components/tag-input.tsx`
- Test: `src/components/tag-input.test.tsx`

**Interfaces:**
- Produces: `TagInput` — chip-style editor over a `string[]`.
  - Props: `value: string[]`, `onChange: (tags: string[]) => void`, `placeholder?: string`.
  - Adds a trimmed tag on **Enter** or **comma**; ignores blanks and case-insensitive duplicates. Removes a tag via its × button, and removes the last tag on **Backspace** when the input is empty. Each chip has an accessible remove button labelled `Remove {tag}`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/tag-input.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagInput } from "./tag-input";

describe("TagInput", () => {
  it("adds a trimmed tag on Enter", async () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "  work  {Enter}");
    expect(onChange).toHaveBeenCalledWith(["work"]);
  });

  it("does not add case-insensitive duplicates", async () => {
    const onChange = vi.fn();
    render(<TagInput value={["work"]} onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "WORK{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag via its remove button", async () => {
    const onChange = vi.fn();
    render(<TagInput value={["work", "home"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /remove work/i }));
    expect(onChange).toHaveBeenCalledWith(["home"]);
  });

  it("removes the last tag on Backspace when input is empty", async () => {
    const onChange = vi.fn();
    render(<TagInput value={["work", "home"]} onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "{Backspace}");
    expect(onChange).toHaveBeenCalledWith(["work"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/tag-input.test.tsx`
Expected: FAIL — `./tag-input` has no `TagInput` export.

- [ ] **Step 3: Write the implementation**

Create `src/components/tag-input.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = "Add a tag…",
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const tag = draft.trim();
    setDraft("");
    if (!tag) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 backdrop-blur">
      <AnimatePresence initial={false}>
        {value.map((tag) => (
          <motion.span
            key={tag}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-sm"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => removeTag(tag)}
              className="rounded-full opacity-70 transition hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={placeholder}
        className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/components/tag-input.test.tsx`
Expected: PASS — all four cases green.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check .`
Expected: no type errors; Biome clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/tag-input.tsx src/components/tag-input.test.tsx
git commit -m "feat: add reusable tag input component"
```

---

## Task 7: `CategoryPicker` reusable component (create-on-type)

**Files:**
- Create: `src/components/category-picker.tsx`
- Test: `src/components/category-picker.test.tsx`

**Interfaces:**
- Consumes: `Category` type from `lib/categories.ts`; `DEFAULT_CATEGORY_COLOR` from `lib/category-colors.ts`.
- Produces: `CategoryPicker` — choose one category or create a new one inline.
  - Props: `categories: Category[]`, `value: string | null` (selected category id), `onChange: (id: string | null) => void`, `onCreate: (name: string) => Promise<Category>`.
  - A search input filters the list. When the typed text matches no existing category (case-insensitive), a **"Create '{text}'"** button appears; clicking it calls `onCreate`, then selects the returned category via `onChange`. Selecting an existing option calls `onChange` with its id. A "None" option clears the selection.

- [ ] **Step 1: Write the failing tests**

Create `src/components/category-picker.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";
import { CategoryPicker } from "./category-picker";

const CATS: Category[] = [
  {
    id: "c1",
    user_id: "u1",
    name: "Work",
    color: "#6366f1",
    created_at: "",
  },
];

describe("CategoryPicker", () => {
  it("selects an existing category by id", async () => {
    const onChange = vi.fn();
    render(
      <CategoryPicker
        categories={CATS}
        value={null}
        onChange={onChange}
        onCreate={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^work$/i }));
    expect(onChange).toHaveBeenCalledWith("c1");
  });

  it("offers create-on-type for an unknown name and selects the result", async () => {
    const created: Category = {
      id: "c2",
      user_id: "u1",
      name: "Home",
      color: "#10b981",
      created_at: "",
    };
    const onCreate = vi.fn().mockResolvedValue(created);
    const onChange = vi.fn();
    render(
      <CategoryPicker
        categories={CATS}
        value={null}
        onChange={onChange}
        onCreate={onCreate}
      />,
    );
    await userEvent.type(screen.getByRole("textbox"), "Home");
    await userEvent.click(screen.getByRole("button", { name: /create "home"/i }));
    expect(onCreate).toHaveBeenCalledWith("Home");
    expect(onChange).toHaveBeenCalledWith("c2");
  });

  it("does not offer create when the name already exists", async () => {
    render(
      <CategoryPicker
        categories={CATS}
        value={null}
        onChange={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByRole("textbox"), "work");
    expect(
      screen.queryByRole("button", { name: /create "work"/i }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/category-picker.test.tsx`
Expected: FAIL — `./category-picker` has no `CategoryPicker` export.

- [ ] **Step 3: Write the implementation**

Create `src/components/category-picker.tsx`:

```tsx
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { Category } from "@/lib/categories";

interface CategoryPickerProps {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate: (name: string) => Promise<Category>;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  onCreate,
}: CategoryPickerProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const trimmed = query.trim();
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const exactExists = categories.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = trimmed.length > 0 && !exactExists;

  async function handleCreate() {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(trimmed);
      onChange(created.id);
      setQuery("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search or create a category…"
        className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full px-3 py-1 text-sm transition ${
            value === null ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
          }`}
        >
          None
        </button>
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition ${
              value === c.id ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            {c.name}
          </button>
        ))}
        {canCreate && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500/80 to-purple-500/80 px-3 py-1 text-sm text-white transition hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Create "{trimmed}"
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/components/category-picker.test.tsx`
Expected: PASS — all three cases green.

- [ ] **Step 5: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check .`
Expected: no type errors; Biome clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/category-picker.tsx src/components/category-picker.test.tsx
git commit -m "feat: add category picker with create-on-type"
```

---

## Task 8: `/categories` page + `CategoryManager` (optimistic CRUD)

**Files:**
- Create: `src/app/(app)/categories/page.tsx` (server component)
- Create: `src/app/(app)/categories/category-manager.tsx` (client component)
- Test: `src/app/(app)/categories/category-manager.test.tsx`

**Interfaces:**
- Consumes: `listCategories` + server client (page); `Category`, `createCategory`, `updateCategory`, `deleteCategory` + browser client (manager); `CATEGORY_COLORS`, `DEFAULT_CATEGORY_COLOR`; `ColorSwatch`; `toast` from `sonner`.
- Produces: the `/categories` route — a Keep-style manager with an add row (create-then-render: add awaits the DB-generated id before showing the row), plus **optimistic** inline rename, recolor, and delete that roll back with a toast on failure.

- [ ] **Step 1: Write the server page (auth guard + initial load)**

Create `src/app/(app)/categories/page.tsx`. Because the Phase 1 middleware is a no-op stub, this page guards its own auth with `getUser()` and redirects to `/login` when unauthenticated:

```tsx
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
```

- [ ] **Step 2: Write the failing test for the manager**

Create `src/app/(app)/categories/category-manager.test.tsx`. Mock the browser Supabase client and the data-access module so no network happens; assert optimistic rendering:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/categories";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock("@/lib/categories", () => ({
  createCategory: (...a: unknown[]) => create(...a),
  updateCategory: (...a: unknown[]) => update(...a),
  deleteCategory: (...a: unknown[]) => remove(...a),
}));

import { CategoryManager } from "./category-manager";

const CATS: Category[] = [
  { id: "c1", user_id: "u1", name: "Work", color: "#6366f1", created_at: "" },
];

beforeEach(() => {
  create.mockReset();
  update.mockReset();
  remove.mockReset();
});

describe("CategoryManager", () => {
  it("renders the initial categories", () => {
    render(<CategoryManager initial={CATS} />);
    expect(screen.getByDisplayValue("Work")).toBeInTheDocument();
  });

  it("adds a category on submit", async () => {
    create.mockResolvedValue({
      id: "c2",
      user_id: "u1",
      name: "Home",
      color: "#8b5cf6",
      created_at: "",
    });
    render(<CategoryManager initial={CATS} />);
    await userEvent.type(
      screen.getByPlaceholderText(/new category/i),
      "Home",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getByDisplayValue("Home")).toBeInTheDocument();
    expect(create).toHaveBeenCalled();
  });

  it("optimistically removes a category on delete", async () => {
    remove.mockResolvedValue(undefined);
    render(<CategoryManager initial={CATS} />);
    await userEvent.click(screen.getByRole("button", { name: /delete work/i }));
    expect(screen.queryByDisplayValue("Work")).not.toBeInTheDocument();
    expect(remove).toHaveBeenCalledWith(expect.anything(), "c1");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test "src/app/(app)/categories/category-manager.test.tsx"`
Expected: FAIL — `./category-manager` has no `CategoryManager` export.

- [ ] **Step 4: Write the client manager**

Create `src/app/(app)/categories/category-manager.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ColorSwatch } from "@/components/color-swatch";
import { GlassPanel } from "@/components/glass-panel";
import {
  type Category,
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/categories";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from "@/lib/category-colors";
import { createClient } from "@/lib/supabase/client";

export function CategoryManager({ initial }: { initial: Category[] }) {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>(initial);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState<string>(DEFAULT_CATEGORY_COLOR);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    setDraftName("");
    try {
      const created = await createCategory(supabase, { name, color: draftColor });
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setDraftColor(DEFAULT_CATEGORY_COLOR);
    } catch {
      toast.error("Could not add category");
    }
  }

  async function handleRename(cat: Category, name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === cat.name) return;
    const prev = categories;
    setCategories((cs) =>
      cs.map((c) => (c.id === cat.id ? { ...c, name: trimmed } : c)),
    );
    try {
      await updateCategory(supabase, cat.id, { name: trimmed });
    } catch {
      setCategories(prev);
      toast.error("Could not rename category");
    }
  }

  async function handleRecolor(cat: Category, color: string) {
    const prev = categories;
    setCategories((cs) =>
      cs.map((c) => (c.id === cat.id ? { ...c, color } : c)),
    );
    try {
      await updateCategory(supabase, cat.id, { color });
    } catch {
      setCategories(prev);
      toast.error("Could not update color");
    }
  }

  async function handleDelete(cat: Category) {
    const prev = categories;
    setCategories((cs) => cs.filter((c) => c.id !== cat.id));
    try {
      await deleteCategory(supabase, cat.id);
    } catch {
      setCategories(prev);
      toast.error("Could not delete category");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-lg font-semibold tracking-tight">Categories</h1>

      <GlassPanel intensity="medium" className="!p-4">
        <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="New category…"
            className="min-w-[10rem] flex-1 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex items-center gap-1.5">
            {CATEGORY_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                selected={draftColor === color}
                onSelect={setDraftColor}
              />
            ))}
          </div>
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-600 hover:to-purple-600"
          >
            Add
          </button>
        </form>
      </GlassPanel>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {categories.map((cat) => (
            <motion.li
              key={cat.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-2xl"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <input
                type="text"
                defaultValue={cat.name}
                aria-label={`Rename ${cat.name}`}
                onBlur={(e) => handleRename(cat, e.target.value)}
                className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none focus:underline"
              />
              <div className="flex items-center gap-1.5">
                {CATEGORY_COLORS.map((color) => (
                  <ColorSwatch
                    key={color}
                    color={color}
                    selected={cat.color === color}
                    onSelect={(c) => handleRecolor(cat, c)}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label={`Delete ${cat.name}`}
                onClick={() => handleDelete(cat)}
                className="rounded-lg p-1.5 opacity-70 transition hover:bg-red-500/20 hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {categories.length === 0 && (
        <p className="px-1 text-sm opacity-70">
          No categories yet. Add your first one above.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test "src/app/(app)/categories/category-manager.test.tsx"`
Expected: PASS — all three cases green.

- [ ] **Step 6: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check .`
Expected: no type errors; Biome clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/categories"
git commit -m "feat: add categories management page with optimistic CRUD"
```

---

## Task 9: Header link to `/categories`

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Test: `src/app/(app)/layout.test.tsx`

**Interfaces:**
- Consumes: the existing app-shell header.
- Produces: a "Categories" link in the header that navigates to `/categories`, sitting alongside the Tasks⇄Notes nav without disturbing it.

- [ ] **Step 1: Write the failing test**

Create `src/app/(app)/layout.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/tasks" }));

import { ThemeProvider } from "@/components/theme-provider";
import AppLayout from "./layout";

describe("AppLayout", () => {
  it("shows a link to the categories page", () => {
    render(
      <ThemeProvider>
        <AppLayout>
          <div>content</div>
        </AppLayout>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("link", { name: /categories/i }),
    ).toHaveAttribute("href", "/categories");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test "src/app/(app)/layout.test.tsx"`
Expected: FAIL — no link named "categories" exists yet.

- [ ] **Step 3: Add the link**

Modify `src/app/(app)/layout.tsx` — add a `Link` to `/categories` inside the right-hand controls group, before the `ThemeToggle`. Add the import at the top (`import Link from "next/link";`) and insert the link:

```tsx
          <div className="flex items-center gap-2">
            <Link
              href="/categories"
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur transition hover:bg-white/20"
            >
              Categories
            </Link>
            <ThemeToggle />
            <form action="/auth/signout" method="post">
```

(Leave the rest of the file unchanged.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test "src/app/(app)/layout.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `bun run test && bunx tsc --noEmit && bunx biome check .`
Expected: entire suite green; no type errors; Biome clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/layout.tsx" "src/app/(app)/layout.test.tsx"
git commit -m "feat: link to categories page from app header"
```

---

## Task 10: Feature documentation

**Files:**
- Create: `docs/categories.md`

**Interfaces:**
- Produces: a concise feature doc per the `docs/` convention (≤250 lines, references paths — no pasted source).

- [ ] **Step 1: Write the doc**

Create `docs/categories.md`:

```markdown
# Categories & Tags

Shared, user-owned categories (Google-Keep-labels style) plus reusable tag/category
input components. Shipped in Phase 2.

## What's implemented

- `categories` table with owner-scoped RLS — `supabase/migrations/0002_categories.sql`
  (RLS test: `supabase/tests/rls_categories.test.sql`).
- Data-access CRUD — `src/lib/categories.ts` (`listCategories`, `createCategory`,
  `updateCategory`, `deleteCategory`); takes any Supabase client (server or browser).
- Color palette — `src/lib/category-colors.ts`.
- `/categories` management page — `src/app/(app)/categories/page.tsx` (server: auth
  guard + initial load) + `category-manager.tsx` (client: optimistic add / rename /
  recolor / delete with `sonner` toast rollback).
- Reusable components (for Phases 3–4): `src/components/category-picker.tsx`
  (create-on-type), `src/components/tag-input.tsx`, `src/components/color-swatch.tsx`.
- Toast provider — `sonner`, mounted in `src/app/layout.tsx`.

## How it works

- `user_id` defaults to `auth.uid()` in the DB, so client inserts never send an owner;
  RLS enforces isolation. A case-insensitive unique index on `(user_id, lower(name))`
  keeps create-on-type from duplicating names.
- The page loads categories server-side (SSR) and hands them to a client component that
  owns optimistic state; mutations go through the browser Supabase client and roll back
  on error.

## Out of scope (later phases)

- Filtering task/note lists by category or tag (Phases 3–5).
- `tasks` / `notes` tables and the `category_id` FK (`on delete set null`) that ties
  items to categories.
```

- [ ] **Step 2: Commit**

```bash
git add docs/categories.md
git commit -m "docs: document categories & tags feature"
```

---

## Phase 2 Done — Definition of Done

- [ ] `categories` table exists with RLS enabled and four owner-scoped policies; migration applied; RLS test passes (or manually verified in the dashboard).
- [ ] `lib/categories.ts` CRUD is unit-tested (mocked client) and green.
- [ ] `CategoryPicker` (with create-on-type), `TagInput`, and `ColorSwatch` are implemented and unit-tested.
- [ ] `/categories` page guards auth server-side, loads the list SSR, adds via create-then-render, and supports optimistic rename / recolor / delete with toast rollback.
- [ ] Header links to `/categories`; Tasks⇄Notes nav still works unchanged.
- [ ] `sonner` toast provider is mounted globally.
- [ ] `docs/categories.md` exists.
- [ ] Full verification green: `bun run test`, `bunx tsc --noEmit`, `bunx biome check .`.
- [ ] No filtering, no `tasks`/`notes` tables, no capture modal (correctly deferred).

## Notes for Later Phases

- **Filtering** hooks onto the `text[]` tags (GIN-indexed in Phases 3–4) and `category_id`
  once the Tasks/Notes list UIs exist. `CategoryPicker` and `TagInput` are ready to drop in.
- When Phases 3–4 create `tasks`/`notes`, give their `category_id` FK
  `on delete set null` so deleting a category leaves items intact (per the spec).
- `createCategory` surfaces the unique-index violation as a thrown error; Phases 3–4 using
  create-on-type from the picker should toast a friendly "category already exists" if desired.
- **v2 sharing (deferred):** v1 keeps every category owner-scoped (one `user_id`). If/when v2
  adds shared spaces or per-item sharing (see spec §9), the categories model would gain a
  space/membership dimension and RLS would grant access by membership or share grant instead
  of sole ownership. Build none of that now — just don't hard-code assumptions that a category
  can only ever have a single owner into UI copy or types beyond what's here.
