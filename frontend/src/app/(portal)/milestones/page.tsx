"use client";

import { CalendarClock, CalendarDays, FolderKanban, Search, User } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/progress-bits";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { OverdueBadge, StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounced, useFetch } from "@/hooks/use-fetch";
import { cn, formatDate } from "@/lib/utils";
import type { Milestone } from "@/types";

function dotClass(m: Milestone) {
  if (m.status === "completed") return "bg-emerald-500 ring-emerald-200";
  if (m.is_overdue) return "bg-red-500 ring-red-200";
  if (m.status === "in_review") return "bg-gold ring-gold/30";
  if (m.status === "in_progress") return "bg-sky-500 ring-sky-200";
  return "bg-slate-400 ring-slate-200";
}

export default function MilestonesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [scope, setScope] = useState("all");
  const debounced = useDebounced(search);

  const params = useMemo(
    () => ({
      search: debounced.trim() || undefined,
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      personal: scope === "personal" ? true : scope === "project" ? false : undefined,
    }),
    [debounced, status, priority, scope],
  );

  const { data, loading, error, reload } = useFetch<Milestone[]>("/api/milestones", params);
  const filtered = !!(search || status !== "all" || priority !== "all" || scope !== "all");

  const summary = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.length,
      completed: list.filter((m) => m.status === "completed").length,
      active: list.filter((m) => m.status === "in_progress").length,
      overdue: list.filter((m) => m.is_overdue).length,
      avg: list.length ? Math.round(list.reduce((s, m) => s + m.progress, 0) / list.length) : 0,
    };
  }, [data]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="My Milestones" description="Key deliverables on your timeline, ordered by deadline." />

      {data && data.length > 0 && (
        <Card className="mb-5 grid grid-cols-2 gap-px overflow-hidden bg-line p-0 sm:grid-cols-5">
          {[
            ["Total", summary.total],
            ["In progress", summary.active],
            ["Completed", summary.completed],
            ["Overdue", summary.overdue],
            ["Avg. progress", `${summary.avg}%`],
          ].map(([label, value], i) => (
            <div key={label} className={cn("bg-white px-5 py-4", i === 4 && "col-span-2 sm:col-span-1")}>
              <p className="text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-navy">{value}</p>
            </div>
          ))}
        </Card>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <Input placeholder="Search milestones…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search milestones" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger aria-label="Scope"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Project &amp; personal</SelectItem>
            <SelectItem value="project">Project milestones</SelectItem>
            <SelectItem value="personal">Personal milestones</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : error && !data ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title={filtered ? "No milestones match your filters" : "No milestones yet"}
            description={filtered ? "Try adjusting your filters." : "Milestones assigned to you will appear on this timeline."}
          />
        </Card>
      ) : (
        <ol className={cn("relative ml-2 space-y-5 border-l-2 border-line pl-5 sm:ml-4 sm:pl-7", loading && "opacity-60")}>
          {data.map((m) => (
            <li key={m.id} className="relative">
              <span className={cn("absolute top-6 -left-[31px] size-4 rounded-full border-[3px] border-white ring-4 sm:-left-[39px]", dotClass(m))} />
              <Link href={`/milestones/${m.id}`} className="group block">
                <Card className="p-5 transition-all group-hover:border-gold/50 group-hover:shadow-pop">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                          <CalendarDays className="size-3.5" />
                          {formatDate(m.deadline, "EEE, MMM d, yyyy")}
                        </span>
                        {m.is_overdue && <OverdueBadge />}
                      </div>
                      <h3 className="font-display text-lg font-semibold text-navy group-hover:text-gold-dark">{m.title}</h3>
                      {m.description && <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{m.description}</p>}
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-muted">
                        {m.is_personal ? <User className="size-3.5" /> : <FolderKanban className="size-3.5" />}
                        {m.project?.name ?? "Personal milestone"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 lg:w-64">
                      <ProgressBar value={m.progress} overdue={m.is_overdue} />
                      <div className="flex items-center gap-2">
                        <StatusBadge kind="milestone" value={m.status} />
                        <StatusBadge kind="priority" value={m.priority} />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
