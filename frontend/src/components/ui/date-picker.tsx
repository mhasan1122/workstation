"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function toDate(value?: string | null) {
  if (!value) return undefined;
  try {
    return parseISO(value);
  } catch {
    return undefined;
  }
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  id,
  allowClear = true,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  allowClear?: boolean;
}) {
  const selected = toDate(value);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 flex-1 justify-start gap-2 px-3 font-medium",
              !selected && "text-ink-muted",
            )}
          >
            <CalendarDays className="size-4 text-gold-dark" />
            {selected ? format(selected, "MMM d, yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(day) => onChange(day ? format(day, "yyyy-MM-dd") : null)}
            defaultMonth={selected}
          />
        </PopoverContent>
      </Popover>
      {allowClear && selected ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear date"
          onClick={() => onChange(null)}
          disabled={disabled}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
