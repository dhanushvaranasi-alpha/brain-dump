# Categories & Tags

Per-user categories (Google-Keep-labels style) shared across a user's tasks and notes,
plus reusable tag/category input components. Shipped in Phase 2.

## What's implemented

- `categories` table with owner-scoped RLS — `supabase/migrations/0002_categories.sql`
  (RLS test: `supabase/tests/rls_categories.test.sql`).
- Data-access CRUD — `src/lib/categories.ts` (`listCategories`, `createCategory`,
  `updateCategory`, `deleteCategory`); takes any Supabase client (server or browser).
- Color palette — `src/lib/category-colors.ts`.
- `/categories` management page — `src/app/(app)/categories/page.tsx` (server: auth
  guard + initial load) + `category-manager.tsx` (client: add via create-then-render;
  optimistic rename / recolor / delete with `sonner` toast rollback).
- Reusable components (for Phases 3–4): `src/components/category-picker.tsx`
  (create-on-type), `src/components/tag-input.tsx`, `src/components/color-swatch.tsx`.
- Header link to `/categories` — `src/app/(app)/layout.tsx`.
- Toast provider — `sonner`, mounted in `src/app/layout.tsx`.

## How it works

- **Multi-user, isolated:** every category belongs to one user. `user_id` defaults to
  `auth.uid()` in the DB, so client inserts never send an owner; RLS (`auth.uid() =
  user_id`) enforces that users only ever see their own categories. A case-insensitive
  unique index on `(user_id, lower(name))` keeps create-on-type from duplicating names,
  while still letting two different users each have a "Work" category.
- The page loads categories server-side (SSR) and hands them to a client component that
  owns optimistic state; mutations go through the browser Supabase client and roll back
  on error.

## Applying the migration

`supabase/migrations/0002_categories.sql` must be applied to the Supabase project before
the page works against the live DB — via `supabase db push` (linked CLI), a local
`supabase db reset` (Docker), or by pasting the SQL into the dashboard SQL Editor.

## Out of scope (later phases / v2)

- Filtering task/note lists by category or tag (Phases 3–5).
- `tasks` / `notes` tables and the `category_id` FK (`on delete set null`) that ties
  items to categories.
- **Cross-user sharing / collaboration is a v2 concern** (see the design spec §9); v1
  keeps every category owner-scoped.
