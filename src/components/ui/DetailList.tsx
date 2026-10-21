import type { ReactNode } from "react";

export interface DetailItem {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

export function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className={item.fullWidth ? "sm:col-span-2" : undefined}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{item.label}</dt>
          <dd className="mt-1 text-sm text-neutral-700">{item.value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}
