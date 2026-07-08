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
