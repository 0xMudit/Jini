import type { LucideIcon } from "lucide-react";

export function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <article className="metric">
      <span><Icon size={18} /></span>
      <div><strong>{value}</strong><small>{label}</small></div>
    </article>
  );
}
