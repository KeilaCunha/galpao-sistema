import { CheckCircle2, XCircle, X, Info } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: "border-success-500/30 bg-white text-success-600",
  error: "border-danger-500/30 bg-white text-danger-600",
  info: "border-brand-500/30 bg-white text-brand-700",
};

const ICON_BG: Record<ToastType, string> = {
  success: "bg-success-50 text-success-600",
  error: "bg-danger-50 text-danger-600",
  info: "bg-brand-50 text-brand-600",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const value: ToastContextValue = {
    showSuccess: (message) => push("success", message),
    showError: (message) => push("error", message),
    showInfo: (message) => push("info", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg shadow-neutral-900/10 animate-in",
                STYLES[toast.type],
              )}
              role="alert"
            >
              <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", ICON_BG[toast.type])}>
                <Icon size={16} strokeWidth={2.5} />
              </span>
              <p className="flex-1 text-sm font-medium text-neutral-700">{toast.message}</p>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="mt-0.5 text-neutral-400 transition hover:text-neutral-600"
                aria-label="Fechar notificação"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}
