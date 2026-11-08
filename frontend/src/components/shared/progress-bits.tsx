"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function progressColor(pct: number, overdue?: boolean) {
  if (overdue) return "bg-red-500";
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 60) return "bg-navy";
  if (pct >= 30) return "bg-gold";
  return "bg-gold";
}

/** Compact progress bar + percent label. */
export function ProgressBar({
  value,
  overdue,
  className,
  showLabel = true,
}: {
  value: number;
  overdue?: boolean;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Progress value={value} indicatorClassName={progressColor(value, overdue)} className="h-1.5" />
      {showLabel && (
        <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-navy">
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
}

/** Styled range slider with gold thumb. */
export function RangeSlider({
  value,
  onChange,
  disabled,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="range"
      min={0}
      max={100}
      step={5}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        background: `linear-gradient(to right, #0B2545 ${value}%, #E8EEF5 ${value}%)`,
      }}
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50",
        "[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:shadow-md",
        "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-gold",
        "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2",
      )}
    />
  );
}
