# brain-dump Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a logged-in, glassmorphism-themed brain-dump web app with magic-link auth, a verified RLS pattern, and a Tasks⇄Notes navigation shell showing empty states.

**Architecture:** Next.js (App Router, TypeScript) frontend styled with Tailwind CSS v4 and a glassmorphism theme layer (light/dark via `next-themes`). Supabase provides Postgres + Auth; sessions are managed server-side with `@supabase/ssr` (browser client, per-request server client, and a middleware that refreshes the session on every request). A `profiles` table with Row-Level Security establishes the RLS pattern that every later feature table will follow.

**Tech Stack:** Next.js 15+ (App Router), TypeScript, Tailwind CSS v4, `next-themes`, `@supabase/ssr` + `@supabase/supabase-js`, Supabase CLI (local dev + migrations), Vitest + @testing-library/react + happy-dom (component/unit tests), Biome (lint + format). Package manager: **Bun**.

## Global Constraints

- Package manager is **Bun** — use `bun add`, `bun add -d`, `bunx`. Never use npm/pnpm.
- **Never run the dev server or a production build** as a verification step. Verify with Vitest tests, `bunx tsc --noEmit` (typecheck), and Biome (lint/format) only.
- Run Python-free — this is a TS/JS project; no Python involved.
- Commit messages: short, conventional-commit prefixes (`feat:`, `chore:`, `test:`, etc.). Never mention any AI assistant/model/vendor.
- Every DB table is scoped to the authenticated user and protected by RLS (`auth.uid() = user_id`).
- Supabase env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Glassmorphism aesthetic: frosted translucent surfaces (`backdrop-blur`), gradient backdrop, light+dark with system default + manual toggle. Enforce text contrast over translucent surfaces.

---

## File Structure

```
brain-dump/
├── package.json                         # Bun-managed
├── next.config.ts
├── tsconfig.json
├── biome.json                           # lint + format config
├── vitest.config.ts
├── vitest.setup.ts                      # RTL + happy-dom setup
├── postcss.config.mjs                   # Tailwind v4 postcss plugin
├── .env.local                           # Supabase keys (gitignored)
├── .env.example                         # documented placeholders (committed)
├── middleware.ts                        # session refresh + route guard
├── supabase/
│   ├── config.toml                      # from `supabase init`
│   └── migrations/
│       └── 0001_profiles.sql            # profiles table + RLS + signup trigger
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # root layout: ThemeProvider + gradient backdrop
│   │   ├── globals.css                  # Tailwind import + theme tokens + glass utilities
│   │   ├── page.tsx                     # redirects to /tasks
│   │   ├── login/page.tsx               # magic-link login form
│   │   ├── auth/confirm/route.ts        # verifyOtp confirm handler
│   │   ├── auth/signout/route.ts        # sign-out handler
│   │   └── (app)/                       # authenticated group
│   │       ├── layout.tsx               # app shell: nav + user chip
│   │       ├── tasks/page.tsx           # empty Tasks view
│   │       └── notes/page.tsx           # empty Notes view
│   ├── components/
│   │   ├── theme-provider.tsx           # next-themes wrapper
│   │   ├── theme-toggle.tsx             # light/dark/system toggle
│   │   ├── glass-panel.tsx              # reusable frosted surface
│   │   ├── view-nav.tsx                 # Tasks⇄Notes segmented nav
│   │   └── empty-state.tsx              # reusable empty state
│   └── lib/
│       └── supabase/
│           ├── client.ts                # createBrowserClient
│           └── server.ts                # createServerClient (per request)
└── tests/                               # co-located *.test.ts(x) preferred; see tasks
```

---

## Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `biome.json`, `vitest.config.ts`, `vitest.setup.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Produces: a runnable Next.js App Router project with `bun test` (Vitest), `bunx tsc --noEmit`, and `bunx biome check` all green.

- [ ] **Step 1: Scaffold Next.js app into the current directory**

Run (answer prompts: TypeScript yes, App Router yes, `src/` dir yes, Tailwind yes, import alias `@/*`; decline ESLint if asked since we use Biome):

```bash
bunx create-next-app@latest . --ts --app --src-dir --tailwind --import-alias "@/*" --no-eslint --use-bun
```

Expected: project files created; `package.json` present.

- [ ] **Step 2: Add dev tooling dependencies**

```bash
bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event happy-dom @vitejs/plugin-react @biomejs/biome
```

Expected: packages appear under `devDependencies` in `package.json`.

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Create `vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Configure Biome**

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "files": { "ignore": ["node_modules", ".next", "supabase/.branches", "supabase/.temp"] }
}
```

Add scripts to `package.json` (`scripts` object):

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

- [ ] **Step 5: Write the smoke test**

Create `src/lib/smoke.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

describe("project scaffold", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the smoke test — verify it passes**

Run: `bun run test`
Expected: PASS — 1 passed.

- [ ] **Step 7: Run typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check .`
Expected: no type errors; Biome reports no errors (fix any auto-fixable issues with `bunx biome check --write .`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and Biome"
```

---

## Task 2: Supabase clients + middleware

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `middleware.ts`, `.env.example`
- Modify: `.gitignore` (ensure `.env.local` ignored — usually already is)
- Test: `src/lib/supabase/client.test.ts`

**Interfaces:**
- Produces:
  - `createClient(): SupabaseClient` (browser) from `@/lib/supabase/client`
  - `createClient(): Promise<SupabaseClient>` (server, async, per-request) from `@/lib/supabase/server`
  - `middleware(request: NextRequest): Promise<NextResponse>` refreshing the session

- [ ] **Step 1: Install Supabase packages**

```bash
bun add @supabase/ssr @supabase/supabase-js
```

Expected: both under `dependencies`.

- [ ] **Step 2: Add env example and local env**

Create `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Create `.env.local` with the same keys filled from your Supabase project (Settings → API). Confirm `.env.local` is in `.gitignore`.

- [ ] **Step 3: Write the browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4: Write the server client (per request)**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — safe to ignore; middleware refreshes the session
          }
        },
      },
    },
  );
}
```

- [ ] **Step 5: Write the middleware (session refresh + guard)**

Create `middleware.ts` (project root):

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              response.headers.set(key, value);
            }
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 6: Write a test asserting the browser client factory works**

Create `src/lib/supabase/client.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { createClient } from "./client";

describe("browser supabase client", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
  });

  it("creates a client exposing auth", () => {
    const supabase = createClient();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.auth.signInWithOtp).toBe("function");
  });
});
```

- [ ] **Step 7: Run the test — verify it passes**

Run: `bun run test src/lib/supabase/client.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck, lint, commit**

Run: `bunx tsc --noEmit && bunx biome check --write .`

```bash
git add -A
git commit -m "feat: add supabase browser/server clients and session middleware"
```

---

## Task 3: Database schema + RLS pattern (profiles)

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`, `supabase/config.toml` (from `supabase init`)
- Test: `supabase/tests/rls_profiles.test.sql` (pgTAP) OR a documented manual check (see Step 5)

**Interfaces:**
- Produces: a `public.profiles` table (`id uuid pk references auth.users`, `created_at timestamptz`) with RLS enabled, self-access policies, and an `on_auth_user_created` trigger that inserts a profile row. Establishes the `auth.uid() = <user column>` policy pattern reused by every later feature table.

- [ ] **Step 1: Initialize Supabase locally**

```bash
bunx supabase init
```

Expected: `supabase/config.toml` created. (If Docker is available, `bunx supabase start` runs a local stack for testing; otherwise apply migrations to your cloud project via `bunx supabase link` + `bunx supabase db push`.)

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/0001_profiles.sql`:

```sql
-- profiles: one row per auth user; establishes the RLS pattern
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- auto-create a profile when a new auth user signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Apply the migration**

If running locally: `bunx supabase db reset` (applies all migrations to the local DB).
If applying to cloud: `bunx supabase link --project-ref <ref>` then `bunx supabase db push`.
Expected: migration applies with no errors.

- [ ] **Step 4: Write an RLS test (pgTAP)**

Create `supabase/tests/rls_profiles.test.sql`:

```sql
begin;
select plan(2);

-- RLS is enabled on profiles
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS enabled on profiles'
);

-- anon role cannot read profiles (no rows visible without auth.uid())
set local role anon;
select is_empty(
  'select 1 from public.profiles',
  'anon sees no profile rows'
);

select * from finish();
rollback;
```

- [ ] **Step 5: Run the RLS test**

If local stack is running: `bunx supabase test db`
Expected: both assertions pass.
(If Docker/local stack is unavailable, instead verify manually: in the Supabase dashboard SQL editor confirm `select relrowsecurity from pg_class where oid='public.profiles'::regclass;` returns `true`, and that querying `profiles` as the anon key returns zero rows. Record the result in the commit message.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add profiles table with RLS and signup trigger"
```

---

## Task 4: Magic-link login page

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/login-form.tsx`
- Test: `src/app/login/login-form.test.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`.
- Produces: `<LoginForm />` client component that calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })` and shows a "check your email" confirmation state.

- [ ] **Step 1: Write the failing test**

Create `src/app/login/login-form.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp } }),
}));

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  beforeEach(() => signInWithOtp.mockClear());

  it("sends a magic link and shows confirmation", async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "me@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "me@example.com" }),
    );
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun run test src/app/login/login-form.test.tsx`
Expected: FAIL — cannot resolve `./login-form`.

- [ ] **Step 3: Implement the login form**

Create `src/app/login/login-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GLASS =
  "rounded-2xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className={`${GLASS} max-w-sm text-center`}>
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-2 text-sm opacity-80">
          We sent a magic link to {email}. Click it to sign in.
        </p>
      </div>
    );
  }

  return (
    <div className={`${GLASS} max-w-sm`}>
      <h1 className="text-lg font-semibold">Sign in to brain-dump</h1>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-500/80 px-3 py-2 font-medium text-white backdrop-blur transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send magic link"}
        </button>
      </form>
    </div>
  );
}
```

The login form is self-contained (inline glass styling via the `GLASS` constant), so it has no dependency on components introduced in later tasks. The shared `GlassPanel` primitive arrives in Task 6.

- [ ] **Step 4: Add the login page**

Create `src/app/login/page.tsx`:

```tsx
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 5: Run test — verify it passes**

Run: `bun run test src/app/login/login-form.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `bunx tsc --noEmit && bunx biome check --write .`

```bash
git add -A
git commit -m "feat: add magic-link login page"
```

---

## Task 5: Auth confirm + sign-out routes

**Files:**
- Create: `src/app/auth/confirm/route.ts`, `src/app/auth/signout/route.ts`
- Test: `src/app/auth/confirm/route.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`.
- Produces:
  - `GET /auth/confirm?token_hash=…&type=…&next=/tasks` → verifies OTP, redirects to `next` (default `/tasks`) on success or `/login?error=…` on failure.
  - `POST /auth/signout` → signs out, redirects to `/login`.

- [ ] **Step 1: Write the failing test**

Create `src/app/auth/confirm/route.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

import { GET } from "./route";

function req(url: string) {
  return new Request(url) as unknown as import("next/server").NextRequest;
}

describe("GET /auth/confirm", () => {
  beforeEach(() => verifyOtp.mockReset());

  it("redirects to next on success", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await GET(
      req("http://localhost/auth/confirm?token_hash=abc&type=email&next=/tasks"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/tasks");
  });

  it("redirects to /login on failure", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const res = await GET(
      req("http://localhost/auth/confirm?token_hash=bad&type=email"),
    );
    expect(res.headers.get("location")).toContain("/login");
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun run test src/app/auth/confirm/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Implement the confirm route**

Create `src/app/auth/confirm/route.ts`:

```typescript
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/tasks";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 4: Implement the sign-out route**

Create `src/app/auth/signout/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
```

- [ ] **Step 5: Run test — verify it passes**

Run: `bun run test src/app/auth/confirm/route.test.ts`
Expected: PASS — both cases.

- [ ] **Step 6: Configure Supabase redirect URL**

In the Supabase dashboard → Authentication → URL Configuration, add `http://localhost:3000/auth/confirm` (and your production URL later) to the allowed redirect URLs. Record this step as done in the commit body.

- [ ] **Step 7: Typecheck, lint, commit**

Run: `bunx tsc --noEmit && bunx biome check --write .`

```bash
git add -A
git commit -m "feat: add auth confirm and signout routes"
```

---

## Task 6: Theme system (light/dark + glass tokens)

**Files:**
- Create: `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/components/glass-panel.tsx`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Test: `src/components/theme-toggle.test.tsx`, `src/components/glass-panel.test.tsx`

**Interfaces:**
- Consumes: `next-themes`.
- Produces:
  - `<ThemeProvider>` wrapping the app (attribute `class`, default `system`).
  - `<ThemeToggle />` cycling light → dark → system.
  - `<GlassPanel className?>` — a frosted surface primitive used across the app.

- [ ] **Step 1: Install next-themes**

```bash
bun add next-themes
```

- [ ] **Step 2: Write failing tests**

Create `src/components/glass-panel.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlassPanel } from "./glass-panel";

describe("GlassPanel", () => {
  it("renders children and applies a backdrop-blur surface", () => {
    render(<GlassPanel data-testid="p">hello</GlassPanel>);
    const el = screen.getByTestId("p");
    expect(el).toHaveTextContent("hello");
    expect(el.className).toMatch(/backdrop-blur/);
  });
});
```

Create `src/components/theme-toggle.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("renders an accessible theme control", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

Run: `bun run test src/components/glass-panel.test.tsx src/components/theme-toggle.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the theme provider**

Create `src/components/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 5: Implement the glass panel**

Create `src/components/glass-panel.tsx`:

```tsx
import { type HTMLAttributes } from "react";

export function GlassPanel({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        "rounded-2xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-xl " +
        "dark:border-white/10 dark:bg-white/5 " +
        className
      }
      {...props}
    />
  );
}
```

- [ ] **Step 6: Implement the theme toggle**

Create `src/components/theme-toggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? (theme ?? "system") : "system";
  const label = current[0].toUpperCase() + current.slice(1);

  function cycle() {
    const idx = ORDER.indexOf(current as (typeof ORDER)[number]);
    setTheme(ORDER[(idx + 1) % ORDER.length]);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur transition hover:bg-white/20"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 7: Wire theme tokens + glass backdrop into globals.css**

Replace `src/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --backdrop-from: #eef2ff;
  --backdrop-via: #faf5ff;
  --backdrop-to: #ecfeff;
  --foreground: #0f172a;
}

.dark {
  --backdrop-from: #0b1020;
  --backdrop-via: #1a1030;
  --backdrop-to: #041826;
  --foreground: #e5e7eb;
}

body {
  color: var(--foreground);
  min-height: 100vh;
  background:
    radial-gradient(1200px 600px at 15% -10%, var(--backdrop-from), transparent 60%),
    radial-gradient(1000px 500px at 100% 0%, var(--backdrop-via), transparent 55%),
    linear-gradient(160deg, var(--backdrop-via), var(--backdrop-to));
  background-attachment: fixed;
}
```

- [ ] **Step 8: Wrap the app in ThemeProvider**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "brain-dump",
  description: "Fast capture for tasks and notes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Run tests — verify they pass**

Run: `bun run test src/components/glass-panel.test.tsx src/components/theme-toggle.test.tsx`
Expected: PASS.

- [ ] **Step 10: Typecheck, lint, commit**

Run: `bunx tsc --noEmit && bunx biome check --write .`

```bash
git add -A
git commit -m "feat: add glassmorphism theme system with light/dark toggle"
```

---

## Task 7: App shell with Tasks⇄Notes nav + empty views

**Files:**
- Create: `src/components/view-nav.tsx`, `src/components/empty-state.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/tasks/page.tsx`, `src/app/(app)/notes/page.tsx`
- Modify: `src/app/page.tsx` (redirect to `/tasks`)
- Test: `src/components/view-nav.test.tsx`

**Interfaces:**
- Consumes: `ThemeToggle`, `GlassPanel`, `EmptyState`, and `usePathname` from `next/navigation`.
- Produces:
  - `<ViewNav />` — segmented control linking `/tasks` and `/notes`, marking the active route with `aria-current="page"`.
  - `(app)/layout.tsx` — authenticated shell rendering header (brand, `ViewNav`, `ThemeToggle`, sign-out) around `children`.
  - `<EmptyState title icon? description />`.

- [ ] **Step 1: Write the failing test**

Create `src/components/view-nav.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/tasks" }));

import { ViewNav } from "./view-nav";

describe("ViewNav", () => {
  it("links to tasks and notes and marks the active one", () => {
    render(<ViewNav />);
    const tasks = screen.getByRole("link", { name: /tasks/i });
    const notes = screen.getByRole("link", { name: /notes/i });
    expect(tasks).toHaveAttribute("href", "/tasks");
    expect(notes).toHaveAttribute("href", "/notes");
    expect(tasks).toHaveAttribute("aria-current", "page");
    expect(notes).not.toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun run test src/components/view-nav.test.tsx`
Expected: FAIL — cannot resolve `./view-nav`.

- [ ] **Step 3: Implement ViewNav**

Create `src/components/view-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/notes", label: "Notes" },
] as const;

export function ViewNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-lg px-4 py-1.5 text-sm font-medium transition " +
              (active ? "bg-white/70 text-slate-900 shadow dark:bg-white/20 dark:text-white" : "opacity-70 hover:opacity-100")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Implement EmptyState**

Create `src/components/empty-state.tsx`:

```tsx
import { GlassPanel } from "./glass-panel";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <GlassPanel className="mx-auto mt-10 max-w-md text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm opacity-75">{description}</p>
    </GlassPanel>
  );
}
```

- [ ] **Step 5: Implement the authenticated shell layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { ViewNav } from "@/components/view-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-24 pt-4">
      <header className="mb-6 flex items-center justify-between gap-3">
        <span className="text-lg font-semibold tracking-tight">brain-dump</span>
        <ViewNav />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur transition hover:bg-white/20"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Implement the empty Tasks and Notes views**

Create `src/app/(app)/tasks/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";

export default function TasksPage() {
  return (
    <EmptyState
      title="No tasks yet"
      description="Capture your first task — due dates, priorities, and checklists come next."
    />
  );
}
```

Create `src/app/(app)/notes/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";

export default function NotesPage() {
  return (
    <EmptyState
      title="No notes yet"
      description="Your markdown knowledge base will live here."
    />
  );
}
```

- [ ] **Step 7: Redirect the root to /tasks**

Replace `src/app/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/tasks");
}
```

- [ ] **Step 8: Run test — verify it passes**

Run: `bun run test src/components/view-nav.test.tsx`
Expected: PASS.

- [ ] **Step 9: Full verification — all tests, typecheck, lint**

Run: `bun run test && bunx tsc --noEmit && bunx biome check --write .`
Expected: all test files pass; no type errors; Biome clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add app shell with tasks/notes nav and empty states"
```

---

## Phase 1 Done — Definition of Done

- `bun run test` passes (smoke, supabase client, login form, auth confirm, glass panel, theme toggle, view nav).
- `bunx tsc --noEmit` clean; `bunx biome check .` clean.
- Migration `0001_profiles.sql` applied; RLS verified on `profiles`.
- Manual acceptance (user-run, since dev server is not part of automated verification): visiting the app while signed out redirects to `/login`; a magic link signs the user in and lands on `/tasks`; the Tasks⇄Notes nav switches views; the theme toggle cycles light/dark/system with the gradient glass backdrop; sign-out returns to `/login`.

## Notes for Later Phases

- Phase 2 (categories & tags) and beyond reuse the RLS pattern from Task 3 and the `GlassPanel`/`EmptyState`/`ViewNav` primitives.
- The `(app)` route group already enforces auth via `middleware.ts`; feature pages drop into `(app)/`.
- When adding feature tables, generate types with `bunx supabase gen types typescript` and wire them into the Supabase clients' generics.
