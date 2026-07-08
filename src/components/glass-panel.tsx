import { type HTMLAttributes } from "react";

export function GlassPanel({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
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
