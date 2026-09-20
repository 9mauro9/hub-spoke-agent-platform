import React from "react";
import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  onClick,
  hoverable = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-lg shadow-black/20 transition-all",
        hoverable && "hover:border-slate-700 hover:shadow-slate-800/10 cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
};
