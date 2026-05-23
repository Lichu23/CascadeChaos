import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-emerald-500 text-zinc-950 hover:bg-emerald-400",
  secondary: "bg-zinc-800 text-zinc-50 hover:bg-zinc-700",
  ghost: "bg-transparent text-zinc-300 hover:bg-zinc-900",
};

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}

