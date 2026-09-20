import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'xs' | 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  pulse = false,
  className
}) => {
  const variantStyles = {
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
    success: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80',
    warning: 'bg-amber-950/70 text-amber-300 border-amber-800/80',
    danger: 'bg-rose-950/70 text-rose-300 border-rose-800/80',
    info: 'bg-sky-950/70 text-sky-300 border-sky-800/80',
    purple: 'bg-purple-950/70 text-purple-300 border-purple-800/80'
  };

  const pulseColors = {
    neutral: 'bg-slate-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    purple: 'bg-purple-400'
  };

  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[10px] font-medium tracking-wide',
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold'
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md border font-mono uppercase transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={clsx(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              pulseColors[variant]
            )}
          />
          <span
            className={clsx('relative inline-flex rounded-full h-1.5 w-1.5', pulseColors[variant])}
          />
        </span>
      )}
      {children}
    </span>
  );
};
