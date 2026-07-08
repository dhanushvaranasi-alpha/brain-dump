import { ThemeToggle } from "@/components/theme-toggle";
import { ViewNav } from "@/components/view-nav";

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
