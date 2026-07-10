"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/notes", label: "Notes" },
] as const;

export function ViewNav() {
  const pathname = usePathname();
  return (
    <motion.nav
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex gap-1 rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur-2xl shadow-xl"
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: ITEMS.indexOf(item) * 0.05 }}
          >
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-300 ${
                active
                  ? "bg-gradient-to-r from-indigo-500/80 to-purple-500/80 text-white shadow-lg shadow-indigo-500/25"
                  : "opacity-70 hover:opacity-100 hover:bg-white/10 hover:scale-105"
              }`}
            >
              {item.label}
            </Link>
          </motion.div>
        );
      })}
    </motion.nav>
  );
}
