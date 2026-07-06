# AGENTS.md — brain-dump

Operational instructions for any AI coding agent/model working in this repo. Follow these
exactly. They override default behavior.

## What this project is

A personal, mobile-first web app for fast capture of **tasks** and **notes**, with shared
categories, tags, and full-text search. Stack: **Next.js (App Router, TypeScript)** +
**Tailwind CSS** + **Supabase** (Postgres, Auth, RLS). UI direction: **glassmorphism**
(frosted panels, gradient backdrop, light/dark with system default + toggle).

## Read before coding

1. `docs/superpowers/specs/brain-dump-design.md` — the design (what & why).
2. `docs/superpowers/plans/phase-1-foundation.md` — the current implementation plan; code from this.
3. `docs/superpowers/plans/phase-1-handoff-notes.md` — creds, git state, and task gotchas.

Work happens on the `phase-1-foundation` branch (branched from `main`).

## Package management — Bun only

- Use **Bun** for everything: `bun add`, `bun add -d` (dev deps), `bunx`. **Never** use npm or pnpm.
- Distinguish production vs dev dependencies: runtime libs via `bun add`; tooling/test libs via `bun add -d`.
- Bun is installed at `~/.bun/bin/bun`. If not on PATH: `export PATH="$HOME/.bun/bin:$PATH"`.

## Verification — never run the dev server or a build

Do **not** run `next dev` / `next build` to check your work. Verify only with:

- `bun run test` — Vitest (unit/component tests)
- `bunx tsc --noEmit` — typecheck
- `bunx biome check .` — lint/format (auto-fix: `bunx biome check --write .`)

Follow **TDD**: write the failing test first, watch it fail, implement, watch it pass, commit.

## Commits

- Small, frequent commits — one per completed task/step group.
- Short messages with conventional prefixes: `feat:`, `fix:`, `chore:`, `test:`, `docs:`.
- **Never** mention any AI assistant, model, or vendor in commit messages or code.

## Supabase & security

- **Every table has Row-Level Security** enabled with owner-scoped policies (`auth.uid() = user_id`).
- Env vars (`.env.local`, gitignored):
  ```
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # value may be the new sb_publishable_... key
  ```
- The publishable/anon key is **public** (safe in frontend). **Never** put the
  `service_role` / `sb_secret_...` key in the frontend or in `.env.local`.
- Applying migrations needs Docker (local Supabase), `supabase login` + `db push` (cloud),
  or pasting the SQL into the dashboard SQL Editor. Add
  `http://localhost:3000/auth/confirm` to the project's Auth redirect URLs.

## Code organization

- Keep files small and single-purpose; follow the file structure in the plan.
- Don't overbuild (YAGNI). Implement only what the current task specifies.
- Preserve existing working functionality; don't remove/refactor unrelated code without reason.

## Docs & official references

- When using a library/framework/API, prefer its **current official docs** over memory —
  patterns change (especially `@supabase/ssr` auth). Verify before writing config/auth code.

## Filenames

- Do **not** prepend dates (`YYYY-MM-DD-`) to filenames. Use plain descriptive names; put
  any date inside the document if useful.
