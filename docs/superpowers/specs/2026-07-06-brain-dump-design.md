# brain-dump — Design Spec

**Date:** 2026-07-06
**Status:** Approved (design), pending implementation plan

## 1. Concept

A personal, mobile-first web app for fast capture and easy retrieval of everything on your
mind. You capture an item and choose its type — **Task** or **Note** — then organize it with
**shared categories** and freeform **tags**, and find anything through **global full-text
search**. The app has two primary views the user toggles between: **Tasks** and **Notes**.

Single-user, personal use. Cloud-synced across devices (phone + laptop) via a backend.

## 2. Tech Stack

- **Next.js** (App Router) + **React** — mobile-first responsive, PWA-installable
- **Tailwind CSS** — styling
- **Supabase** — Postgres (data), Auth (magic-link email login, no passwords), Row-Level Security
- **Markdown notes** — lightweight editor (textarea + `react-markdown` render) with an
  edit/preview toggle
- **Bun** — package manager
- **Deploy** — Vercel (frontend) + Supabase cloud (backend)

## 3. UI Design Direction

**Aesthetic: Glassmorphism.** Frosted-glass panels (backdrop blur, translucency, subtle
border/inner highlights) layered over soft vibrant accent gradients; depth conveyed through
layering and soft shadows. Premium, modern feel — especially on mobile.

- **Theme:** Light and dark, following system by default with a manual toggle. A subtle gradient
  backdrop sits behind the frosted surfaces in both themes to sell the glass effect.
- **Motion:** Rich but tasteful — spring-based transitions (e.g. Framer Motion), a satisfying
  task check-off/complete animation, subtle hover/press states. Respects
  `prefers-reduced-motion`.
- **Implementation notes:**
  - Tailwind utilities for glass surfaces (`backdrop-blur`, translucent backgrounds, ring/border
    highlights); theme tokens via CSS variables.
  - Accessibility: glass can hurt legibility — enforce sufficient text contrast over translucent
    surfaces and provide solid fallbacks where needed.
  - Mobile performance: limit the number of stacked blur layers to keep scrolling smooth.
- Detailed visual execution (component styling, typography scale, exact palette) will be handled
  by the `frontend-design` skill during implementation.

## 4. Data Model

All rows are scoped to the authenticated user and protected by Row-Level Security (RLS).

### categories
User-managed, shared across tasks and notes.
- `id` (uuid, pk)
- `user_id` (uuid, fk → auth.users)
- `name` (text)
- `color` (text)
- `created_at` (timestamptz)

### tasks
- `id` (uuid, pk)
- `user_id` (uuid, fk → auth.users)
- `title` (text)
- `description` (text, nullable)
- `category_id` (uuid, fk → categories, nullable)
- `tags` (text[], GIN-indexed)
- `priority` (enum: `none` | `low` | `med` | `high`, default `none`)
- `due_at` (timestamptz, nullable)
- `status` (enum: `todo` | `done`, default `todo`)
- `recurrence` (jsonb, nullable) — e.g. `{ "freq": "weekly", "interval": 1 }`
- `completed_at` (timestamptz, nullable)
- `created_at`, `updated_at` (timestamptz)
- `search_vector` (tsvector, GIN-indexed, generated from title + description)

### subtasks
Checklist items belonging to a task, ordered.
- `id` (uuid, pk)
- `task_id` (uuid, fk → tasks, on delete cascade)
- `title` (text)
- `is_done` (boolean, default false)
- `position` (int)

### notes
- `id` (uuid, pk)
- `user_id` (uuid, fk → auth.users)
- `title` (text)
- `body` (text, markdown)
- `category_id` (uuid, fk → categories, nullable)
- `tags` (text[], GIN-indexed)
- `created_at`, `updated_at` (timestamptz)
- `search_vector` (tsvector, GIN-indexed, generated from title + body)

### Search
A Postgres function (RPC) queries both `tasks` and `notes` `search_vector` columns and returns
a unified, ranked result set. Tags stored as `text[]` with GIN indexes (simplest approach for
single-user scale). Trade-off: renaming a tag globally is not a first-class operation; acceptable
for v1.

## 5. Key Features

- **Quick capture** — floating "+" button opens a capture modal; pick Task or Note; save with
  minimal friction.
- **Tasks**
  - Due dates with grouping: Today / Overdue / Upcoming / No date
  - Priority flags (none / low / med / high)
  - Subtask checklists (ordered, checkable)
  - Recurring tasks (daily / weekly / monthly with interval); on completion the next occurrence
    is generated with a recomputed `due_at`
  - Check-off to complete
- **Notes** — markdown body with edit/preview toggle, title, tags, category
- **Shared categories** — manage (add / edit / delete, pick a color); assign to any task or note
- **Tags** — freeform labels; filter by them
- **View toggle** — Tasks ⇄ Notes as the primary navigation (mobile: segmented control /
  bottom nav; state persists)
- **Global search** — one search box; mixed task + note results; matches text, tags, category
- **Auth** — magic-link login and logout; user only ever sees their own data (enforced by RLS)

## 6. App Structure

Routes:
- `/tasks` — Tasks view
- `/notes` — Notes view
- `/search` — search results (or an inline overlay)
- `/login` — magic-link login
- `/auth/callback` — Supabase auth callback

Shared components: capture modal, category picker, tag input, item card (task/note).

Library layer:
- `lib/supabase` — browser and server Supabase clients
- Per-entity data-access modules (categories, tasks, subtasks, notes, search)
- Server actions (or route handlers) for mutations, with RLS enforced at the DB

## 7. Error Handling

- Optimistic UI updates with rollback on failure
- Toast notifications for errors
- Auth-guard redirects to `/login` when unauthenticated
- Friendly empty states for each view
- Graceful connection-error handling (data is cloud-synced, not offline-first)

## 8. Testing

- **Unit** — pure logic: recurrence next-date calculation, search query building
- **Integration** — data-access modules + RLS policies (a user cannot read another user's rows)
- **Component** — capture modal and the Tasks/Notes view toggle
- **E2E (Playwright)** — core flow: capture a task → complete it → find it via search

## 9. Out of Scope for v1 (YAGNI)

- Sharing / collaboration / multi-user
- Offline-first sync
- AI features
- Note-to-note backlinks
- Folders / notebooks
