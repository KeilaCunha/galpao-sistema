import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyTitle = "Nenhum registro encontrado",
  emptyDescription = "Tente ajustar os filtros ou cadastre um novo registro.",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-900/5">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-900/5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              {columns.map((col) => (
                <th
                  key={col.header}
                  className={cn(
                    "border-b border-neutral-200 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500",
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="border-b border-neutral-100 last:border-0 transition-colors hover:bg-neutral-50/70"
              >
                {columns.map((col) => (
                  <td key={col.header} className={cn("px-5 py-3.5 align-middle text-neutral-700", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
