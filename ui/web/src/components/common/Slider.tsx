import React from "react";
import { clsx } from "clsx";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  className?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  className,
  disabled = false,
}) => {
  return (
    <div className={clsx("space-y-2", className)}>
      <div className="flex justify-between items-center text-sm">
        <label className="font-medium text-slate-300">{label}</label>
        <span className="font-mono text-indigo-400 font-semibold">
          {unit}
          {value.toLocaleString()}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div className="flex justify-between text-xs text-slate-500 font-mono">
        <span>
          {unit}
          {min}
        </span>
        <span>
          {unit}
          {max}
        </span>
      </div>
    </div>
  );
};
