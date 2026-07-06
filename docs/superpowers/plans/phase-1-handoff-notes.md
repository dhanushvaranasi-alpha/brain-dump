# brain-dump — Phase 1 Coding Handoff Notes

> **Purpose:** Everything an implementer (human or LLM) needs to start coding Phase 1
> that is **not** already in the spec/plan files. Read this alongside the two documents below.

## Documents to read (in order)

1. **Design spec (what & why):** `docs/superpowers/specs/brain-dump-design.md`
   - App concept, glassmorphism UI direction, data model, feature list, scope boundaries.
2. **Phase 1 implementation plan (how — code from this):** `docs/superpowers/plans/phase-1-foundation.md`
   - Self-contained: 7 tasks, each with exact file paths, complete code, TDD steps,
     verification commands, and per-task commits. Execute top-to-bottom.

## 1. Supabase credentials (for `.env.local`, created in Task 2)

```
NEXT_PUBLIC_SUPABASE_URL=https://ehxfmgudfnnyaqfkxfex.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_1DTzeCb1Bf2gIZ-Qq_mfuA_mKgEh3CR
```

- The key value is Supabase's **new publishable key** (`sb_publishable_…`), which replaces
  the legacy `anon` JWT. It works as a drop-in for the anon key and still respects RLS.
- It is a **public** key (safe in frontend code). Do **not** use the `service_role` /
  `sb_secret_…` key anywhere in the frontend or in `.env.local`.
- `.env.local` is gitignored — do not commit it.

## 2. Tooling rules (from the plan's Global Constraints)

- **Package manager: Bun only.** Use `bun add`, `bun add -d`, `bunx`. Never npm/pnpm.
  - Bun is installed at `~/.bun/bin/bun` (v1.3.14). If it's not on PATH in a fresh shell:
    `export PATH="$HOME/.bun/bin:$PATH"`.
- **Never run the dev server or a production build to verify.** Verify only with:
  - `bun run test` (Vitest)
  - `bunx tsc --noEmit` (typecheck)
  - `bunx biome check .` (lint/format; auto-fix with `bunx biome check --write .`)
- **Commit messages:** short, conventional prefixes (`feat:`, `chore:`, `test:`…).
  Never mention any AI assistant/model/vendor in commits or code.

## 3. Git state

- Specs/plans are committed on `main`.
- Implementation work goes on branch **`phase-1-foundation`** (already created off `main`).
- Confirm you're on it: `git branch --show-current` → `phase-1-foundation`.

## 4. Task 1 gotcha — repo root is not empty

The repo root already contains `.git/`, `README.md`, `docs/`, and `.superpowers/`.
`bunx create-next-app@latest .` will refuse to scaffold into a non-empty directory.

**Approach:** scaffold into a temp dir, then copy the generated files into the repo root,
**preserving** `docs/` and `.superpowers/` and merging (not clobbering) `.gitignore` /
`README.md`:

```bash
export PATH="$HOME/.bun/bin:$PATH"
bunx --bun create-next-app@latest /tmp/bd-scaffold \
  --ts --app --src-dir --tailwind --import-alias "@/*" --no-eslint --use-bun --yes
# then copy /tmp/bd-scaffold/* (and dotfiles) into the repo root, keeping docs/ + .superpowers/
```

## 5. Task 3 external steps (DB migration + auth redirect)

- **Applying the migration** needs one of:
  - **Docker** running → `bunx supabase start` then `bunx supabase db reset` (local), or
  - **Supabase CLI auth** → `bunx supabase login` + `bunx supabase link --project-ref ehxfmgudfnnyaqfkxfex`
    then `bunx supabase db push` (applies to the cloud project), or
  - **Manual fallback** → paste the contents of `supabase/migrations/0001_profiles.sql`
    into the Supabase dashboard **SQL Editor** and run it.
- **Auth redirect (required for magic-link login, Task 5):** in the Supabase dashboard →
  **Authentication → URL Configuration → Redirect URLs**, add:
  ```
  http://localhost:3000/auth/confirm
  ```
  (Add your production URL later when you deploy.)

## 6. Roadmap beyond Phase 1

Phase 1 is only the foundation (auth + RLS pattern + glass shell + Tasks/Notes nav).
Remaining phases, in build order (each becomes its own plan when Phase 1 is verified):

1. **Foundation** ← this plan
2. **Categories & tags** — shared category CRUD + color, tag input, filters
3. **Tasks** — capture, due dates, priority, subtasks, recurrence, complete
4. **Notes** — markdown capture + edit/preview, category/tags
5. **Search** — unified full-text search RPC + UI
6. **Polish** — motion, empty states, PWA, accessibility pass

## 7. Environment note (if using sandboxed subagents)

If the implementing tool dispatches sandboxed subagents, note that in this environment
subagents were denied the `bun` binary and network access — so the scaffold/install steps
(which need npm registry access) must run in a context with network + binary permissions,
not a locked-down subagent.
