import { Eye, Pencil, Trash2 } from "lucide-react";

interface RowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function RowActions({ onView, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {onView && (
        <button
          type="button"
          onClick={onView}
          title="Visualizar"
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-brand-50 hover:text-brand-600"
        >
          <Eye size={16} />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Editar"
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-brand-50 hover:text-brand-600"
        >
          <Pencil size={16} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Excluir"
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-danger-50 hover:text-danger-500"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
