import React from "react";
import { clsx } from "clsx";

export type BadgeVariant =
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "neutral"
  | "purple";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  pulse?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  pulse = false,
  className,
  icon,
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    neutral: "bg-slate-800 text-slate-300 border-slate-700",
    purple: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
        variantStyles[variant],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={clsx(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              variant === "success" && "bg-emerald-400",
              variant === "info" && "bg-sky-400",
              variant === "warning" && "bg-amber-400",
              variant === "danger" && "bg-rose-400",
              variant === "purple" && "bg-indigo-400",
              variant === "neutral" && "bg-slate-400"
            )}
          />
          <span
            className={clsx(
              "relative inline-flex rounded-full h-2 w-2",
              variant === "success" && "bg-emerald-500",
              variant === "info" && "bg-sky-500",
              variant === "warning" && "bg-amber-500",
              variant === "danger" && "bg-rose-500",
              variant === "purple" && "bg-indigo-500",
              variant === "neutral" && "bg-slate-500"
            )}
          />
        </span>
      )}
      {icon && <span className="w-3.5 h-3.5 flex items-center justify-center">{icon}</span>}
      {children}
    </span>
  );
};
