import { type HTMLMotionProps, motion } from "framer-motion";
import { forwardRef, type ReactNode } from "react";

interface GlassPanelProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  children: ReactNode;
  intensity?: "light" | "medium" | "strong";
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    { className = "", intensity = "medium", children, ...props },
    ref: React.Ref<HTMLDivElement>,
  ) => {
    const intensities = {
      light: "border border-white/20 bg-white/5 backdrop-blur-xl shadow-lg",
      medium: "border border-white/20 bg-white/10 backdrop-blur-2xl shadow-xl",
      strong: "border border-white/20 bg-white/15 backdrop-blur-3xl shadow-2xl",
    } as const;

    const variations = {
      light:
        "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/20 before:to-transparent before:-z-10",
      medium: "",
      strong: "",
    } as const;

    const effectiveIntensity = intensity || "medium";
    const effectiveVariations =
      variations[effectiveIntensity as keyof typeof variations];

    return (
      <motion.div
        ref={ref}
        className={`relative overflow-hidden rounded-2xl p-6 ${intensities[effectiveIntensity as keyof typeof intensities]} ${effectiveVariations} ${className}`}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);

GlassPanel.displayName = "GlassPanel";
