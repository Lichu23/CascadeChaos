import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ className = "", label, ...props }: InputProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-300">
      {label}
      <input
        className={`h-12 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-base text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400 ${className}`}
        {...props}
      />
    </label>
  );
}

