# brain-dump — Design Spec

**Date:** 2026-07-06
**Status:** Approved (design), pending implementation plan

## 1. Concept

A personal, mobile-first web app for fast capture and easy retrieval of everything on your
mind. You capture an item and choose its type — **Task** or **Note** — then organize it with
**shared categories** and freeform **tags**, and find anything through **global full-text
search**. The app has two primary views the user toggles between: **Tasks** and **Notes**.

**Multi-user:** every user signs in to their own **private space** — their tasks, notes,
and categories are fully isolated from other users by Row-Level Security (`auth.uid() =
user_id`). No data is shared between users in v1; content sharing and collaboration are a
v2 concern (see §9). Each space is personal and cloud-synced across devices (phone +
laptop) via a backend.

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
- `recurrence` (jsonb, nullable) — e.g. `{ "freq": "monthly", "interval": 1, "lead_days": 5 }`
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
a unified, ranked result set. Tags stored as `text[]` with GIN indexes (simplest approach at
this scale; tags are per-user, so each user's tag set is independent). Trade-off: renaming a
tag globally is not a first-class operation; acceptable for v1.

## 5. Key Features

- **Quick capture** — floating "+" button opens a capture modal; pick Task or Note; save with
  minimal friction.
- **Tasks**
  - Due dates with grouping: Today / Overdue / Upcoming / No date
  - Priority flags (none / low / med / high)
  - Subtask checklists (ordered, checkable)
  - Recurring tasks — user picks a **frequency (monthly or annually) with an interval** and a
    **lead time** (days before the due date). The next occurrence is **not** generated at
    completion; instead it **surfaces a configurable number of days before its due date**
    (e.g. next month, 5 days before it's due) so there's time to complete it. Fully
    customisable per task. Config lives in `recurrence` jsonb, e.g.
    `{ "freq": "monthly", "interval": 1, "lead_days": 5 }`.
  - Check-off to complete
- **Notes** — markdown body with edit/preview toggle, title, tags, category
- **Shared categories** — a dedicated `/categories` page manages them **Google-Keep-labels
  style**: inline add, rename, recolor, and delete, with no heavyweight forms. Categories can
  also be **created organically on-the-fly** from the category picker while tagging a task or
  note (type a name that doesn't exist → "Create '…'"). Assign to any task or note; deleting a
  category leaves its items intact (their `category_id` becomes null).
- **Tags** — freeform labels stored as `text[]`; a chip-style input adds/removes them inline.
  Filter by them (filtering ships with the Tasks/Notes lists, not before).
- **View toggle** — Tasks ⇄ Notes as the primary navigation (mobile: segmented control /
  bottom nav; state persists)
- **Global search** — one search box; mixed task + note results; matches text, tags, category
- **Auth** — magic-link login and logout; user only ever sees their own data (enforced by RLS)

## 6. App Structure

Routes:
- `/tasks` — Tasks view
- `/notes` — Notes view
- `/categories` — manage shared categories (add / rename / recolor / delete)
- `/search` — search results (or an inline overlay)
- `/login` — magic-link login
- `/auth/callback` — Supabase auth callback

Shared components: capture modal, category picker (supports create-on-type), tag input,
item card (task/note).

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

The app **is** multi-user in v1 — but only as isolated private spaces (each user sees only
their own data). What's deferred is users working on **shared** content:

- **Content sharing / collaboration — deferred to v2.** Shared spaces/workspaces, sharing an
  individual category/task/note with another user, and any team/role model. When we build
  this, the data model shifts from owner-scoped (`user_id`) toward space/membership-scoped,
  with RLS granting access by membership or share grant rather than sole ownership. Nothing
  in v1 should assume data can only ever belong to one user forever, but v1 builds none of it.
- Offline-first sync
- AI features
- Note-to-note backlinks
- Folders / notebooks
