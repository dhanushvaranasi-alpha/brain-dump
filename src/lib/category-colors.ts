// Preset category colors — glass-friendly, readable in light and dark.
// The first entry matches the DB column default in 0002_categories.sql.
export const CATEGORY_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#64748b", // slate
] as const;

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0];
