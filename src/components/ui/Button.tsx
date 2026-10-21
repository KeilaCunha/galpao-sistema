import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-300 shadow-sm shadow-brand-900/10",
  secondary:
    "bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:ring-brand-200",
  outline:
    "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 focus-visible:ring-neutral-200",
  ghost: "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-neutral-200",
  danger:
    "bg-danger-500 text-white hover:bg-danger-600 focus-visible:ring-danger-200 shadow-sm shadow-danger-900/10",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
