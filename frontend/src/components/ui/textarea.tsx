import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[88px] w-full rounded-lg border border-input bg-white px-3 py-2.5 text-sm text-ink shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
        "focus-visible:border-gold focus-visible:ring-[3px] focus-visible:ring-gold/25 focus-visible:outline-none",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
