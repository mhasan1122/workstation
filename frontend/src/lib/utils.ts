import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export function formatDate(value?: string | Date | null, pattern = "MMM d, yyyy"): string {
  const d = parseDate(value);
  return d ? format(d, pattern) : "—";
}

export function formatDateTime(value?: string | Date | null): string {
  return formatDate(value, "MMM d, yyyy · h:mm a");
}

export function timeAgo(value?: string | Date | null): string {
  const d = parseDate(value);
  if (!d) return "";
  // Backend timestamps are UTC; if no tz designator is present, treat as UTC.
  const fixed =
    typeof value === "string" && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
      ? parseISO(`${value}Z`)
      : d;
  const secs = Math.abs((Date.now() - fixed.getTime()) / 1000);
  if (secs < 45) return "just now";
  return `${formatDistanceToNowStrict(fixed)} ago`;
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatHours(h?: number | null): string {
  if (h === null || h === undefined) return "0h";
  const rounded = Math.round(h * 10) / 10;
  return `${rounded}h`;
}

export function daysLeftLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days}d left`;
}
