import React from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "success";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  ...props
}) => {
  const sizeStyles: Record<ButtonSize, string> = {
    sm: "px-2.5 py-1.5 text-xs font-medium rounded-md gap-1.5",
    md: "px-4 py-2 text-sm font-medium rounded-lg gap-2",
    lg: "px-5 py-2.5 text-base font-medium rounded-lg gap-2.5",
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 border border-indigo-500/50 disabled:bg-indigo-950 disabled:text-indigo-400/50 disabled:border-indigo-900/50",
    secondary:
      "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:bg-slate-900 disabled:text-slate-600",
    danger:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/30 border border-rose-500/50 disabled:bg-rose-950 disabled:text-rose-400/50",
    success:
      "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 border border-emerald-500/50 disabled:bg-emerald-950 disabled:text-emerald-400/50",
    ghost:
      "bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white border border-transparent",
    outline:
      "bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600",
  };

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-sans transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon && <span className="flex items-center justify-center">{icon}</span>
      )}
      {children}
    </button>
  );
};
