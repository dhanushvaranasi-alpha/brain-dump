# brain-dump — Phase 2 Coding Handoff Notes

> **Purpose:** Everything an implementer (human or LLM) needs to start coding Phase 2
> that is **not** already in the spec/plan files. Read this alongside the documents below.

## Documents to read (in order)

1. **Design spec (what & why):** `docs/superpowers/specs/brain-dump-design.md`
   - App concept, glassmorphism UI direction, data model, feature list, scope boundaries.
   - Phase 2 touches §4 (`categories` table, tags as `text[]`), §5 (Shared categories +
     Tags bullets — now describe the Keep-style organic create/delete), §6 (`/categories`
     route + shared components).
2. **Phase 2 implementation plan (how — code from this):** `docs/superpowers/plans/phase-2-categories-tags.md`
   - Self-contained: 10 tasks, each with exact file paths, complete code, TDD steps,
     verification commands, and per-task commits. Execute top-to-bottom.

## 1. What Phase 1 already built (don't re-create)

Phase 1 is merged foundation on the `phase-1-foundation` branch. Already present:

- Next.js 16 App Router + TypeScript + Tailwind v4, Vitest + happy-dom, Biome.
- Supabase clients: `src/lib/supabase/client.ts` (browser) and `server.ts` (per-request).
- `profiles` table + RLS pattern — `supabase/migrations/0001_profiles.sql`; RLS test in
  `supabase/tests/rls_profiles.test.sql`. **Phase 2 copies this exact RLS pattern.**
- Magic-link auth: `/login`, `/auth/confirm`, `/auth/signout`.
- Glass theme system: `ThemeProvider` (`next-themes`), `ThemeToggle`, `GlassPanel`,
  `EmptyState`, `ViewNav` (Tasks⇄Notes segmented nav).
- App shell group `src/app/(app)/` with `layout.tsx` (header) and empty `tasks`/`notes` pages.

## 2. Phase 2 scope (locked)

**In:** the shared-categories foundation — `categories` table + RLS, `lib/categories.ts`
CRUD, a `/categories` Keep-style management page (inline add / rename / recolor / delete,
optimistic + toast rollback), and three reusable presentational components
(`CategoryPicker` with create-on-type, `TagInput`, `ColorSwatch`).

**Out (do NOT build):** filtering by category/tag (needs the Tasks/Notes lists from
Phases 3–4), the `tasks`/`notes`/`subtasks` tables, and any capture modal. There are no
task/note rows yet to attach categories or tags to — the components are built now and
consumed later.

**Multi-user model:** the app is multi-user, but as **isolated private spaces** — each user
sees only their own data, enforced by owner-scoped RLS (`auth.uid() = user_id`). This is
already how Phase 1 works; categories follow the same pattern. **Cross-user sharing /
collaboration is deferred to v2** (spec §9) — do NOT add shared-space, workspace, membership,
or share-grant tables/policies in Phase 2. Keep every category owner-scoped.

## 3. Supabase credentials (already in `.env.local` from Phase 1)

```
NEXT_PUBLIC_SUPABASE_URL=https://ehxfmgudfnnyaqfkxfex.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_1DTzeCb1Bf2gIZ-Qq_mfuA_mKgEh3CR
```

- Publishable key — **public**, safe in the frontend, respects RLS. Never use the
  `service_role` / `sb_secret_…` key in the frontend or in `.env.local`.
- `.env.local` is gitignored — do not commit it.

## 4. Tooling rules (unchanged from Phase 1)

- **Package manager: Bun only.** `bun add`, `bun add -d`, `bunx`. Never npm/pnpm.
  - Bun is at `~/.bun/bin/bun`. If not on PATH: `export PATH="$HOME/.bun/bin:$PATH"`.
- **Never run the dev server or a production build to verify.** Verify only with:
  - `bun run test` (Vitest)
  - `bunx tsc --noEmit` (typecheck)
  - `bunx biome check .` (lint/format; auto-fix with `bunx biome check --write .`)
- **Commit messages:** short, conventional prefixes (`feat:`, `chore:`, `test:`, `docs:`).
  Never mention any AI assistant/model/vendor in commits or code.
- Follow **TDD**: write the failing test, watch it fail, implement, watch it pass, commit.

## 5. New dependency introduced in Phase 2

- **`sonner`** (Task 3) — toast notifications, added as a **runtime** dependency
  (`bun add sonner`, NOT `-d`). It backs the spec's error-handling requirement (toast on
  optimistic-update failure) and every later phase reuses it. Mounted once in
  `src/app/layout.tsx`. `lucide-react` (icons) and `framer-motion` (motion) are already
  installed — no need to add them.

## 6. Applying the migration (`0002_categories.sql`)

Same options as Phase 1 — pick whichever is available:

- **Docker (local Supabase):** `bunx supabase db reset` re-runs all migrations
  (`0001` + `0002`) against the local DB, or
- **Cloud CLI:** `bunx supabase login` + `bunx supabase link --project-ref ehxfmgudfnnyaqfkxfex`
  then `bunx supabase db push` (applies to the cloud project), or
- **Manual fallback:** paste `supabase/migrations/0002_categories.sql` into the Supabase
  dashboard → **SQL Editor** → Run.

No new Auth redirect URLs are needed for Phase 2 (categories has no auth flow of its own).

## 7. Known Phase 1 issue to work around (do NOT fix here)

- `src/middleware.ts` is currently a **no-op debug stub** (it logs and returns
  `NextResponse.next()` without refreshing the session or guarding routes). Because of
  this, the `(app)` group is not auth-guarded at the middleware layer.
- **Phase 2 does not depend on middleware.** The `/categories` **page** guards itself:
  `page.tsx` calls `supabase.auth.getUser()` and `redirect("/login")` when there's no
  user (see Task 8). Data is RLS-protected regardless. Fixing the middleware stub is a
  separate concern — leave it for a dedicated fix, don't bundle it into Phase 2.

## 8. Key implementation gotchas

- **`user_id` defaults to `auth.uid()`** in the migration — so `createCategory` inserts
  only `{ name, color }`; never pass `user_id` from the client (the RLS `insert` policy
  checks `auth.uid() = user_id`).
- **Case-insensitive uniqueness:** the `(user_id, lower(name))` unique index makes
  create-on-type safe. A duplicate insert throws — surface it as a toast if needed.
- **Data-access takes a client parameter.** `lib/categories.ts` functions accept a
  `SupabaseClient` so the server component (SSR load) and the client manager (optimistic
  mutations) share the exact same code. Don't hardcode a client inside the module.
- **Test the query builder with a thenable mock** (see Task 4) — the Supabase chain
  terminates at different methods (`.order()`, `.single()`, `.eq()`), so the mock builder
  must be awaitable at any point.
- **Route group in shell paths:** the page lives at `src/app/(app)/categories/`. When
  passing these paths to `bun run test` or `git add`, quote them so the shell doesn't
  treat `(app)` as a glob — e.g. `git add "src/app/(app)/categories"`.

## 9. Git state

- Phase 2 work lives on its own branch, **`phase-2-categories`**, cut from
  `phase-1-foundation`. Confirm you're on it: `git branch --show-current` →
  `phase-2-categories`.
- The Phase 2 spec/plan/handoff docs are on this branch (commit them first if not already).

## 10. Roadmap position

1. **Foundation** — Phase 1 (done)
2. **Categories & tags** ← **this plan (Phase 2)**
3. **Tasks** — capture, due dates, priority, subtasks, recurrence, complete
4. **Notes** — markdown capture + edit/preview, category/tags
5. **Search** — unified full-text search RPC + UI
6. **Polish** — motion, empty states, PWA, accessibility pass

Phases 3–4 consume Phase 2's `CategoryPicker` and `TagInput` directly, and add the
`category_id` FK (`on delete set null`) plus GIN-indexed `text[]` tags to their tables.
