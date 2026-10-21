import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import { FieldWrapper } from "./FormField";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export function Select({ className, error, children, ...props }: SelectProps) {
  return (
    <div className="w-full">
      <div className="relative">
        <select
          className={cn(
            "h-10 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm text-neutral-700 outline-none transition focus:ring-4",
            error
              ? "border-danger-400 focus:border-danger-400 focus:ring-danger-100"
              : "border-neutral-200 focus:border-brand-400 focus:ring-brand-100",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
          size={16}
        />
      </div>
      {error && <p className="mt-1 text-xs font-medium text-danger-500">{error}</p>}
    </div>
  );
}

interface SelectFieldProps extends SelectProps {
  label: string;
  required?: boolean;
  hint?: string;
}

export function SelectField({ label, required, hint, error, ...props }: SelectFieldProps) {
  return (
    <FieldWrapper label={label} required={required} error={error} hint={hint}>
      <Select error={error} {...props} />
    </FieldWrapper>
  );
}
