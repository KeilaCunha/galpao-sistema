import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function Modal({ open, onClose, title, description, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/50 p-4 py-10 backdrop-blur-[2px] animate-in">
      <div
        className={cn(
          "w-full rounded-2xl bg-white shadow-2xl shadow-neutral-900/20",
          SIZE_CLASSES[size],
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title ? (
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-800">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex justify-end px-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className={cn("px-6", title ? "py-5" : "pb-6 pt-0")}>{children}</div>
      </div>
    </div>
  );
}
