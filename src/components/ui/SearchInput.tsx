import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange, className, placeholder, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Pesquisar..."}
        className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        {...props}
      />
    </div>
  );
}
