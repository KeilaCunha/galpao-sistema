import type { LucideIcon } from "lucide-react";
import { PackageSearch } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon = PackageSearch, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <Icon size={26} />
      </span>
      <div>
        <p className="text-sm font-semibold text-neutral-700">{title}</p>
        {description && <p className="mt-1 text-sm text-neutral-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}
