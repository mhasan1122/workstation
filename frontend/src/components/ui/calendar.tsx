"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        month_caption: "flex justify-center pt-1 relative items-center h-9",
        caption_label: "text-sm font-semibold text-navy",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between px-1",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "absolute left-1 top-0 z-10 text-ink-muted hover:text-navy",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "absolute right-1 top-0 z-10 text-ink-muted hover:text-navy",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-ink-muted w-9 font-semibold text-[11px] uppercase tracking-wide",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "size-9 rounded-lg font-medium aria-selected:opacity-100",
        ),
        selected:
          "[&>button]:bg-navy [&>button]:text-white [&>button]:hover:bg-navy [&>button]:hover:text-white",
        today: "[&>button]:bg-gold-soft [&>button]:text-navy [&>button]:font-bold",
        outside: "text-ink-muted/45 opacity-60",
        disabled: "text-ink-muted/35 opacity-50",
        hidden: "invisible",
        range_middle: "[&>button]:bg-accent [&>button]:text-navy",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
