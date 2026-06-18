import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function SectionHeading({
  action,
  icon: Icon,
  onAction,
  subtitle,
  title,
}: {
  action?: string;
  icon: LucideIcon;
  onAction?: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="section-heading">
      <span className="section-icon"><Icon size={17} /></span>
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {action && onAction ? (
        <button onClick={onAction} type="button">{action}<ChevronRight size={14} /></button>
      ) : null}
    </div>
  );
}
