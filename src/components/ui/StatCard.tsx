import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
}

const TONE_CLASSES: Record<Tone, { bg: string; icon: string }> = {
  brand: { bg: "bg-brand-50", icon: "text-brand-600" },
  success: { bg: "bg-success-50", icon: "text-success-600" },
  warning: { bg: "bg-warning-50", icon: "text-warning-600" },
  danger: { bg: "bg-danger-50", icon: "text-danger-600" },
  neutral: { bg: "bg-neutral-100", icon: "text-neutral-600" },
};

export function StatCard({ label, value, icon: Icon, tone = "brand", hint }: StatCardProps) {
  const toneClasses = TONE_CLASSES[tone];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-900/5">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", toneClasses.bg)}>
        <Icon className={toneClasses.icon} size={22} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-neutral-800">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>}
      </div>
    </div>
  );
}
