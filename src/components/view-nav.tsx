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
              "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition " +
              (active
                ? "bg-indigo-500/80 text-white shadow-md"
                : "opacity-70 hover:opacity-100 hover:bg-white/10")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
