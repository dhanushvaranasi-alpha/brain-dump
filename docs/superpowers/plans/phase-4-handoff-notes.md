# brain-dump — Phase 4 Coding Handoff Notes

> **Purpose:** Everything an implementer (human or LLM) needs to start coding Phase 4
> that is **not** already in the spec/plan files. Read alongside the documents below.

## Documents to read (in order)

1. **Design spec:** `docs/superpowers/specs/brain-dump-design.md` — §4 `subtasks` table,
   §5 Subtask + Tags/filter bullets. Phase 4 builds **subtasks + filtering**; recurrence is Phase 5.
2. **Phase 4 plan (code from this):** `docs/superpowers/plans/phase-4-subtasks-filtering.md`
   — 9 tasks, exact paths, complete code, TDD steps, per-task commits. Execute top-to-bottom.

## 1. What Phases 1–3 already built (reuse; don't rebuild)

All merged to `main`. Available:

- Owner-scoped RLS pattern (`0001`–`0003`); `tasks` table with `tags text[]`, `category_id`.
  **Subtasks scope through the parent task** (not a direct `user_id`) — see the plan's RLS.
- Data-access pattern: modules take a `SupabaseClient` param (`lib/categories.ts`, `lib/tasks.ts`).
  `lib/subtasks.ts` follows this.
- `TaskCard`, `TaskCaptureModal`, `TaskList`, `groupTasks`, `CategoryPicker`, `TagInput`,
  `GlassPanel`, `EmptyState`, `sonner` — all reused.
- The optimistic manager + file-scoped `vi.mock("framer-motion")` test pattern
  (`src/app/(app)/tasks/task-list.test.tsx`) — the Phase 4 test edits keep it.

## 2. Phase 4 scope (locked)

**In:** `subtasks` table + RLS + test; `lib/subtasks.ts` (CRUD + pure `diffSubtasks`);
`lib/task-filter.ts` (pure `filterTasks`); `SubtaskChecklist` + `TaskFilterBar` components;
`TaskCard` subtask badge; `TaskCaptureModal` subtasks section; `/tasks` page + `TaskList`
wiring (SSR-load subtasks, filter-then-group, badges, persist subtasks on save).

**Out (Phase 5 / later — do NOT build):** the recurrence engine, subtask drag-and-drop
reorder, subtask rename, and server-side filtering.

## 3. Credentials & tooling (unchanged)

- Supabase env in `.env.local`; publishable key only in the frontend.
- **Bun only.** `export PATH="$HOME/.bun/bin:$PATH"` if bun isn't on PATH.
- **Never** run the dev server or a build. Verify with `bun run test`, `bunx tsc --noEmit`,
  `bunx biome check .` (auto-fix `--write`). Commits: conventional prefixes; no AI/vendor mentions.
- **TDD:** failing test first, watch it fail, implement, watch it pass, commit.

## 4. Applying the migration (`0004_subtasks.sql`)

`bunx supabase db reset` (Docker), `bunx supabase db push` (linked CLI), or paste into the
dashboard SQL Editor. **Requires `0003_tasks.sql` applied first** (`subtasks.task_id` → `tasks`).
If no live DB in the environment, write + commit and defer (note in the report); the Vitest
suite mocks Supabase and doesn't need the DB.

## 5. Route-group path quoting

`src/app/(app)/tasks/` — `(app)` is a zsh glob. **Always quote:**
`bun run test "src/app/(app)/tasks/task-list.test.tsx"`, `git add "src/app/(app)/tasks"`.

## 6. Implementation gotchas

- **Modal stays presentational.** It holds subtasks as local `SubtaskItem[]` and passes them
  to `onSubmit(input, subtasks)`. The **manager** persists them — do NOT put data-access in the modal.
- **Subtask persistence split:** create → task saves first, then insert each subtask; edit →
  `diffSubtasks(loadedSubtasks, submitted)` gives create/toggle/delete to apply. `diffSubtasks`
  is pure and unit-tested.
- **`SubtaskItem` vs `Subtask`:** persisted rows are `Subtask` (have `id`, `task_id`, `position`);
  the modal's working unit is `SubtaskItem` (`{ id?, title, is_done }`). New drafts have no `id`.
- **Keep Phase 3 tests green:** every new prop is optional with a default — `TaskCard`
  (`subtaskDone?`/`subtaskTotal?` = 0), `TaskCaptureModal` (`initialSubtasks?` = []), `TaskList`
  (`initialSubtasks?` = []). The one intentional breaking change is the modal's `onSubmit`
  signature (now two args); Task 7 updates that test, and `TaskList`'s one-arg handler stays
  assignable so the project still typechecks between Task 7 and Task 8.
- **Order of tasks matters:** Task 7 (modal) changes `onSubmit`; Task 8 (manager) consumes the
  new signature + subtasks. Do them in order.
- **framer-motion test mock:** reuse the existing file-scoped mock in the manager test so
  optimistic unmount (and filter-removal) is synchronous in happy-dom.

## 7. Git state

- Phases 1–3 on `main`. Phase 4 work is on branch **`phase-4-subtasks-filtering`** (cut from `main`).
  Confirm: `git branch --show-current`.
- The Phase 4 spec update + plan + handoff are committed on this branch.

## 8. Roadmap position

1. Foundation (P1) ✓ · 2. Categories & tags (P2) ✓ · 3. Tasks core (P3) ✓
4. **Tasks power — subtasks + filtering** ← this plan (Phase 4)
5. **Recurrence engine** — monthly/annually + lead-time (needs a `pg_cron`-style generator)
6. Notes — markdown capture + edit/preview
7. Search — unified full-text RPC + UI (the `search_vector` columns already exist)
8. Polish — motion, PWA, accessibility
