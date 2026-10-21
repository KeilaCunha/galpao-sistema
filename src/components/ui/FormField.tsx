import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface FieldWrapperProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  hint?: string;
}

export function FieldWrapper({ label, required, error, children, hint }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-neutral-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-danger-500">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

export function Input({ label, required, error, hint, className, ...props }: InputProps) {
  return (
    <FieldWrapper label={label} required={required} error={error} hint={hint}>
      <input
        className={cn(
          "h-10 w-full rounded-lg border bg-white px-3 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none transition focus:ring-4",
          error
            ? "border-danger-400 focus:border-danger-400 focus:ring-danger-100"
            : "border-neutral-200 focus:border-brand-400 focus:ring-brand-100",
          className,
        )}
        {...props}
      />
    </FieldWrapper>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

export function Textarea({ label, required, error, hint, className, ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label} required={required} error={error} hint={hint}>
      <textarea
        className={cn(
          "w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none transition focus:ring-4",
          error
            ? "border-danger-400 focus:border-danger-400 focus:ring-danger-100"
            : "border-neutral-200 focus:border-brand-400 focus:ring-brand-100",
          className,
        )}
        {...props}
      />
    </FieldWrapper>
  );
}
