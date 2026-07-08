import { GlassPanel } from "./glass-panel";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <GlassPanel className="mx-auto mt-10 max-w-md text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm opacity-75">{description}</p>
    </GlassPanel>
  );
}
