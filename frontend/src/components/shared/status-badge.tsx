import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Eye,
  FileEdit,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn, titleCase } from "@/lib/utils";

type Variant = NonNullable<BadgeProps["variant"]>;
interface Cfg {
  label: string;
  variant: Variant;
  icon?: LucideIcon;
}

const TASK: Record<string, Cfg> = {
  todo: { label: "To Do", variant: "neutral", icon: CircleDashed },
  in_progress: { label: "In Progress", variant: "info", icon: PlayCircle },
  in_review: { label: "In Review", variant: "gold", icon: Eye },
  completed: { label: "Completed", variant: "success", icon: CheckCircle2 },
  on_hold: { label: "On Hold", variant: "warning", icon: PauseCircle },
};

const MILESTONE: Record<string, Cfg> = {
  pending: { label: "Pending", variant: "neutral", icon: CircleDashed },
  in_progress: TASK.in_progress,
  in_review: TASK.in_review,
  completed: TASK.completed,
};

const REPORT: Record<string, Cfg> = {
  draft: { label: "Draft", variant: "neutral", icon: FileEdit },
  submitted: { label: "Submitted", variant: "info", icon: Send },
  under_review: { label: "Under Review", variant: "gold", icon: Eye },
  approved: { label: "Approved", variant: "success", icon: CheckCircle2 },
  revision_requested: { label: "Revision Requested", variant: "danger", icon: RotateCcw },
};

const PROJECT: Record<string, Cfg> = {
  planning: { label: "Planning", variant: "neutral", icon: CircleDashed },
  active: { label: "Active", variant: "success", icon: PlayCircle },
  on_hold: { label: "On Hold", variant: "warning", icon: PauseCircle },
  completed: { label: "Completed", variant: "navy", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", variant: "danger", icon: AlertTriangle },
};

const WORK: Record<string, Cfg> = {
  not_started: { label: "Not Started", variant: "neutral", icon: CircleDashed },
  in_progress: TASK.in_progress,
  completed: TASK.completed,
  blocked: { label: "Blocked", variant: "danger", icon: AlertTriangle },
};

const PRIORITY: Record<string, Cfg> = {
  low: { label: "Low", variant: "neutral" },
  medium: { label: "Medium", variant: "info" },
  high: { label: "High", variant: "warning" },
  urgent: { label: "Urgent", variant: "danger" },
};

const MAPS = {
  task: TASK,
  milestone: MILESTONE,
  report: REPORT,
  project: PROJECT,
  work: WORK,
  priority: PRIORITY,
} as const;

export type StatusKind = keyof typeof MAPS;

export function StatusBadge({
  kind,
  value,
  className,
  hideIcon,
}: {
  kind: StatusKind;
  value: string;
  className?: string;
  hideIcon?: boolean;
}) {
  const cfg = MAPS[kind][value] ?? { label: titleCase(value), variant: "neutral" as Variant };
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className={className}>
      {Icon && !hideIcon && <Icon />}
      {cfg.label}
    </Badge>
  );
}

export function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "urgent"
      ? "bg-red-500"
      : priority === "high"
        ? "bg-amber-500"
        : priority === "medium"
          ? "bg-sky-500"
          : "bg-slate-400";
  return <span className={cn("inline-block size-2 rounded-full", color)} aria-hidden />;
}

export function OverdueBadge() {
  return (
    <Badge variant="danger">
      <Clock />
      Overdue
    </Badge>
  );
}

export const TASK_STATUS_LABEL = (v: string) => TASK[v]?.label ?? titleCase(v);
export const REPORT_STATUS_LABEL = (v: string) => REPORT[v]?.label ?? titleCase(v);
