import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Excluir",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onCancel} title="" size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-500">
          <AlertTriangle size={24} />
        </span>
        <div>
          <h3 className="text-base font-semibold text-neutral-800">{title}</h3>
          <p className="mt-1.5 text-sm text-neutral-500">{description}</p>
        </div>
        <div className="mt-2 flex w-full gap-3">
          <Button variant="outline" fullWidth onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" fullWidth onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
