# brain-dump — Phase 3 Coding Handoff Notes

> **Purpose:** Everything an implementer (human or LLM) needs to start coding Phase 3
> that is **not** already in the spec/plan files. Read this alongside the documents below.

## Documents to read (in order)

1. **Design spec (what & why):** `docs/superpowers/specs/brain-dump-design.md`
   - §4 `tasks` table, §5 Tasks features (recurrence model updated to the lead-time design),
     §6 routes. Phase 3 builds the **core**; subtasks/recurrence/filtering are Phase 4.
2. **Phase 3 implementation plan (how — code from this):** `docs/superpowers/plans/phase-3-tasks-core.md`
   - Self-contained: 8 tasks, each with exact file paths, complete code, TDD steps,
     verification commands, and per-task commits. Execute top-to-bottom.

## 1. What Phases 1–2 already built (reuse; don't rebuild)

Merged to `main`. Available to Phase 3:

- Next.js 16 App Router + TS + Tailwind v4, Vitest + happy-dom, Biome; `sonner` toasts
  mounted in `src/app/layout.tsx`.
- Supabase clients: `src/lib/supabase/client.ts` (browser), `server.ts` (per-request).
- Owner-scoped RLS pattern: `0001_profiles.sql`, `0002_categories.sql` — **Phase 3's tasks
  table copies this exactly** (`user_id default auth.uid()`, four owner-scoped policies).
- **Reusable components:** `CategoryPicker` (props `categories, value, onChange, onCreate`),
  `TagInput` (`value, onChange, placeholder?`), `ColorSwatch`, `GlassPanel`, `EmptyState`.
- **Data-access pattern:** `lib/categories.ts` functions take a `SupabaseClient` param so
  the same code runs on server + browser clients — `lib/tasks.ts` follows this.
- **Optimistic manager pattern:** see `src/app/(app)/categories/category-manager.tsx` and its
  test (incl. the file-scoped `vi.mock("framer-motion")` trick that makes optimistic unmount
  synchronous in happy-dom) — the tasks `TaskList` + test mirror it.

## 2. Phase 3 scope (locked)

**In:** the `tasks` table (created **complete**, incl. `recurrence` jsonb + generated
`search_vector`), `lib/tasks.ts` CRUD, pure `lib/task-groups.ts` grouping, `PriorityFlag`,
`TaskCard`, `TaskCaptureModal` (create + edit), and the `/tasks` page + optimistic `TaskList`
(grouped list, floating "+", check-off-to-complete).

**Out (Phase 4 — do NOT build):** subtasks, the recurrence **engine** (the column exists but
is never read/written here), and category/tag **filtering**. There is intentionally no
`subtasks` table in this phase.

## 3. Credentials & tooling (unchanged)

- Supabase env in `.env.local` (from Phase 1): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key — public, RLS-respecting). Never use the
  `service_role` key in the frontend.
- **Bun only:** `bun add`, `bun add -d`, `bunx`. Bun at `~/.bun/bin/bun`; if not on PATH:
  `export PATH="$HOME/.bun/bin:$PATH"`.
- **Never** run the dev server or a build. Verify with `bun run test`, `bunx tsc --noEmit`,
  `bunx biome check .` (auto-fix `--write`).
- Commits: short conventional prefixes; never mention any AI assistant/model/vendor.
- Follow **TDD**: failing test first, watch it fail, implement, watch it pass, commit.

## 4. Applying the migration (`0003_tasks.sql`)

Same options as prior phases — pick whichever is available:
- **Docker:** `bunx supabase db reset` (re-runs all migrations), or
- **Cloud CLI:** `bunx supabase db push` (after `login` + `link`), or
- **Manual:** paste `0003_tasks.sql` into the dashboard **SQL Editor** → Run.

If no live DB is available in the working environment, the migration + `rls_tasks.test.sql`
are written and committed, and application is deferred (note it in the task report). The
Vitest suite mocks Supabase and does **not** need the DB. **Note:** `0002_categories.sql`
must be applied before/with `0003` — `tasks.category_id` references `public.categories`.

## 5. Route-group path quoting (bites every time)

The tasks route lives at `src/app/(app)/tasks/`. `(app)` is a zsh glob — **always quote**
these paths in shell commands:
- `bun run test "src/app/(app)/tasks/task-list.test.tsx"`
- `git add "src/app/(app)/tasks"`

## 6. Implementation gotchas

- **`user_id` defaults to `auth.uid()`** — `createTask` never sends `user_id`; RLS enforces it.
- **Date-only due dates:** the modal's `<input type="date">` yields `"YYYY-MM-DD"`; store
  `due_at = ${date}T00:00:00.000Z`. Grouping/display use `due_at.slice(0,10)` so there's no
  timezone drift. `todayKey` = `new Date().toLocaleDateString("en-CA")` (local YYYY-MM-DD).
- **Add is create-then-render** (await the DB id before inserting the row); **toggle/edit are
  optimistic** with rollback + `toast.error`. Same split as the categories manager.
- **`enum` types:** the migration creates `task_priority` and `task_status` Postgres enums.
  `create type` is not idempotent — only matters if the SQL is manually re-pasted.
- **framer-motion in tests:** `AnimatePresence` keeps exiting children mounted until the exit
  animation resolves (never, in happy-dom), so the `TaskList` test file-scope-mocks
  framer-motion to plain elements (copy the pattern from the categories manager test).
- **Reuse, don't duplicate:** import `CategoryPicker`, `TagInput`, `GlassPanel`, `EmptyState`
  — do not build new versions.

## 7. Git state

- Phases 1–2 are on `main`. Phase 3 work is on branch **`phase-3-tasks`** (cut from `main`).
  Confirm: `git branch --show-current` → `phase-3-tasks`.
- The Phase 3 spec update + plan + handoff are committed on this branch.

## 8. Roadmap position

1. Foundation (Phase 1) ✓ on main
2. Categories & tags (Phase 2) ✓ on main
3. **Tasks core** ← this plan (Phase 3)
4. **Tasks power features** — subtasks, recurrence engine (monthly/annually + lead-time), filtering
5. Notes — markdown capture + edit/preview, category/tags
6. Search — unified full-text RPC + UI (the `search_vector` columns already exist)
7. Polish — motion, PWA, accessibility pass

## 9. Recurrence requirement (verbatim, for Phase 4)

> "The next task doesn't pop up at completion. It pops up next month, 5 days before the due
> date. Also I should be able to choose if I want to repeat it monthly or annually. I should
> be able to customise the recurrence."

Model: `recurrence = { freq: "monthly" | "yearly", interval: N, lead_days: N }`. The next
occurrence **surfaces `lead_days` before its due date**, independent of completion — implying
a scheduled generator (e.g. `pg_cron`) or compute-on-read, to be designed in Phase 4.
