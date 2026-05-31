import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ className = "", label, ...props }: InputProps) {
  return (
    <label className="grid gap-2 text-sm font-bold uppercase text-slate-500">
      <span>{label}</span>
      <input
        className={`h-14 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 ${className}`}
        {...props}
      />
    </label>
  );
}

