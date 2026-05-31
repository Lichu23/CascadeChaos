import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-500 text-white shadow-lg shadow-indigo-300 hover:bg-indigo-600",
  secondary:
    "bg-indigo-50 text-indigo-800 hover:bg-indigo-100",
  ghost:
    "bg-transparent text-indigo-700 hover:bg-indigo-50",
};

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}

