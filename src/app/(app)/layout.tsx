"use client";

import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewNav } from "@/components/view-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-24 pt-4"
    >
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-6 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg font-semibold tracking-tight"
          >
            brain-dump
          </motion.span>
          <ViewNav />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur transition hover:bg-white/20"
              >
                Sign out
              </motion.button>
            </form>
          </div>
        </div>
      </motion.header>
      <motion.main
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex-1"
      >
        {children}
      </motion.main>
    </motion.div>
  );
}
