import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = "Back",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 sm:mb-6 sm:gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          {backHref && (
            <Link
              href={backHref}
              className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-muted transition-colors hover:text-navy"
            >
              <ChevronLeft className="size-4" />
              {backLabel}
            </Link>
          )}
          <h1 className="font-display text-[22px] font-semibold tracking-tight break-anywhere text-navy sm:text-2xl lg:text-[28px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-ink-muted break-anywhere">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
