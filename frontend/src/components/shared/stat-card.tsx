import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  navy: "bg-navy/5 text-navy",
  gold: "bg-gold-soft text-gold-dark",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-600",
  blue: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "navy",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <Card className={cn("p-5 transition-shadow hover:shadow-pop", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {label}
          </p>
          <p className="mt-2 font-display text-[30px] leading-none font-semibold text-navy">
            {value}
          </p>
          {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
