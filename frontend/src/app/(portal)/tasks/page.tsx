"use client";

import { format, parseISO } from "date-fns";
import { ListChecks, Pencil, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ProgressBar } from "@/components/shared/progress-bits";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { OverdueBadge, PriorityDot, StatusBadge } from "@/components/shared/status-badge";
import { CreateTaskDialog, TaskFormDialog } from "@/components/tasks/create-task-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounced, useFetch } from "@/hooks/use-fetch";
import { api, getErrorMessage } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { ProjectListItem, Task, TaskStatus } from "@/types";

const STATUS_CHIPS: { value: "all" | TaskStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
];

export default function TasksPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | TaskStatus>("all");
  const [priority, setPriority] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [overdue, setOverdue] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(null);
  const debounced = useDebounced(search);

  const params = useMemo(
    () => ({
      search: debounced.trim() || undefined,
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      project_id: projectId === "all" ? undefined : Number(projectId),
      overdue: overdue || undefined,
      deadline: deadline || undefined,
    }),
    [debounced, status, priority, projectId, overdue, deadline],
  );

  const tasks = useFetch<Task[]>("/api/tasks", params);
  const projects = useFetch<ProjectListItem[]>("/api/projects");

  const hasFilters = !!(
    search ||
    status !== "all" ||
    priority !== "all" ||
    projectId !== "all" ||
    overdue ||
    deadline
  );
  const reset = () => {
    setSearch("");
    setStatus("all");
    setPriority("all");
    setProjectId("all");
    setOverdue(false);
    setDeadline(null);
  };

  const selectedDay = deadline ? parseISO(deadline) : undefined;
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteTask) return;
    setDeleting(true);
    try {
      await api.delete(`/api/tasks/${deleteTask.id}`);
      toast.success("Task deleted");
      tasks.setData((prev) => (prev ?? []).filter((t) => t.id !== deleteTask.id));
      setDeleteTask(null);
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not delete task"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="My Tasks"
        description="Create tasks with a calendar deadline, or filter by date."
        actions={
          <CreateTaskDialog
            projects={projects.data ?? []}
            defaultDeadline={deadline}
            defaultProjectId={projectId}
            onCreated={(created) => {
              // Active filters (esp. project/date) can hide a brand-new task.
              // Clear them and show the created task immediately.
              setSearch("");
              setStatus("all");
              setPriority("all");
              setProjectId("all");
              setOverdue(false);
              setDeadline(null);
              tasks.setData((prev) => {
                const list = prev ?? [];
                if (list.some((t) => t.id === created.id)) return list;
                return [created, ...list];
              });
              void projects.reload();
            }}
          />
        }
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-bold tracking-[0.14em] text-ink-muted uppercase">Calendar</p>
            {deadline ? (
              <button
                type="button"
                className="text-[12px] font-semibold text-gold-dark hover:underline"
                onClick={() => setDeadline(null)}
              >
                Clear
              </button>
            ) : null}
          </div>
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={(day) => setDeadline(day ? format(day, "yyyy-MM-dd") : null)}
            className="mx-auto"
          />
          <p className="mt-2 px-2 text-center text-[12px] text-ink-muted">
            {deadline ? `Showing tasks due ${formatDate(deadline)}` : "Select a date to filter by deadline"}
          </p>
        </Card>

        <div className="min-w-0">
          <div className="scroll-thin mb-4 flex gap-2 overflow-x-auto pb-1">
            {STATUS_CHIPS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setStatus(c.value)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors",
                  status === c.value
                    ? "border-navy bg-navy text-white"
                    : "border-line bg-white text-ink-muted hover:border-navy/30 hover:text-navy",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <Card className="mb-5 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1.2fr_1.2fr_auto_auto] xl:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="task-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
                  <Input
                    id="task-search"
                    placeholder="Search tasks by title…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All projects</SelectItem>
                    {projects.data?.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <DatePicker value={deadline} onChange={setDeadline} placeholder="Any date" />
              </div>
              <label className="flex h-10 w-full cursor-pointer items-center gap-2 text-[13px] font-semibold text-navy sm:w-auto">
                <Checkbox checked={overdue} onCheckedChange={(v) => setOverdue(v === true)} />
                Overdue only
              </label>
              <Button variant="ghost" className="w-full sm:w-auto" onClick={reset} disabled={!hasFilters}>
                <X />
                Clear
              </Button>
            </div>
          </Card>

          {tasks.loading && !tasks.data ? (
            <ListSkeleton rows={6} />
          ) : tasks.error && !tasks.data ? (
            <Card>
              <ErrorState message={tasks.error} onRetry={tasks.reload} />
            </Card>
          ) : !tasks.data || tasks.data.length === 0 ? (
            <Card>
              <EmptyState
                icon={ListChecks}
                title={hasFilters ? "No tasks match your filters" : "No tasks yet"}
                description={
                  hasFilters
                    ? "Try another date or clear your filters."
                    : "Create a task with Add Task, or wait for an assignment."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={reset}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <Card className={cn("overflow-hidden transition-opacity", tasks.loading && "opacity-60")}>
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <p className="text-[13px] font-semibold text-ink-muted">
                  {tasks.data.length} {tasks.data.length === 1 ? "task" : "tasks"}
                </p>
              </div>
              <div className="table-scroll">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface/70 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
                      <th className="px-5 py-3">Task</th>
                      <th className="px-3 py-3">Priority</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="w-44 px-3 py-3">Progress</th>
                      <th className="px-5 py-3">Deadline</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {tasks.data.map((t) => (
                      <tr key={t.id} className="group transition-colors hover:bg-accent/60">
                        <td className="max-w-[360px] px-5 py-3.5">
                          <Link href={`/tasks/${t.id}`} className="block">
                            <p className="truncate font-semibold text-navy group-hover:text-gold-dark">{t.title}</p>
                            <p className="truncate text-xs text-ink-muted">{t.project?.name ?? "Personal task"}</p>
                          </Link>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex items-center gap-2 text-[13px] font-medium capitalize text-ink">
                            <PriorityDot priority={t.priority} />
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <StatusBadge kind="task" value={t.status} />
                        </td>
                        <td className="px-3 py-3.5">
                          <ProgressBar value={t.progress} overdue={t.is_overdue} />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[13px] text-ink">{formatDate(t.deadline)}</span>
                            {t.is_overdue && <OverdueBadge />}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => setEditTask(t)}
                              aria-label={`Edit ${t.title}`}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setDeleteTask(t)}
                              aria-label={`Delete ${t.title}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      <TaskFormDialog
        open={!!editTask}
        onOpenChange={(o) => !o && setEditTask(null)}
        projects={projects.data ?? []}
        task={editTask}
        onSaved={(updated) => {
          tasks.setData((prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)));
          setEditTask(null);
        }}
      />
      <ConfirmDialog
        open={!!deleteTask}
        onOpenChange={(o) => !o && setDeleteTask(null)}
        title="Delete this task?"
        description={
          deleteTask
            ? `"${deleteTask.title}" will be permanently removed.`
            : "This task will be permanently removed."
        }
        confirmLabel="Delete task"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
