"use client";

import { CalendarDays, CheckCircle2, FolderKanban, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFetch } from "@/hooks/use-fetch";
import { api, getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { MilestoneDetail, ProjectListItem, Task, TaskDetail } from "@/types";
import { AttachmentsPanel, CommentsPanel } from "./collaboration";
import { ConfirmDialog } from "./confirm-dialog";
import { PageHeader } from "./page-header";
import { RangeSlider } from "./progress-bits";
import { ErrorState, PageSkeleton } from "./states";
import { OverdueBadge, StatusBadge } from "./status-badge";

type Kind = "task" | "milestone";

const OPTIONS: Record<Kind, { value: string; label: string }[]> = {
  task: [
    { value: "todo", label: "To Do" },
    { value: "in_progress", label: "In Progress" },
    { value: "on_hold", label: "On Hold" },
    { value: "completed", label: "Done" },
  ],
  milestone: [
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Done" },
  ],
};

const COPY: Record<Kind, { noun: string; back: string; backLabel: string; api: string }> = {
  task: { noun: "task", back: "/tasks", backLabel: "All tasks", api: "/api/tasks" },
  milestone: {
    noun: "milestone",
    back: "/milestones",
    backLabel: "All milestones",
    api: "/api/milestones",
  },
};

export function WorkItemDetail({ kind, id }: { kind: Kind; id: string }) {
  const router = useRouter();
  const copy = COPY[kind];
  const basePath = `${copy.api}/${id}`;
  const { data, loading, error, reload } = useFetch<TaskDetail | MilestoneDetail>(basePath);
  const projects = useFetch<ProjectListItem[]>(kind === "task" ? "/api/projects" : null);

  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const serverStatus = data?.status;
  const serverProgress = data?.progress;
  useEffect(() => {
    if (serverStatus !== undefined && serverProgress !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(serverStatus === "in_review" ? "in_progress" : serverStatus);
      setProgress(serverProgress);
    }
  }, [serverStatus, serverProgress]);

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) {
    return (
      <Card>
        <ErrorState message={error} onRetry={reload} />
      </Card>
    );
  }
  if (!data) return null;

  // Submit-for-review is disabled for now; treat in_review like editable.
  // Milestones still lock when completed.
  const locked = kind === "milestone" && data.status === "completed";
  const dirty =
    (status !== data.status && !(data.status === "in_review" && status === "in_progress")) ||
    progress !== data.progress;
  const canEditMeta = kind === "task" && !locked;
  const canDelete = kind === "task" && !locked;

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (status !== data!.status) payload.status = status;
      if (progress !== data!.progress) payload.progress = progress;
      await api.patch(basePath, payload);
      toast.success(
        status === "completed" || progress >= 100
          ? `${kind === "task" ? "Task" : "Milestone"} marked as done`
          : `${kind === "task" ? "Task" : "Milestone"} updated`,
      );
      await reload();
    } catch (e) {
      toast.error(getErrorMessage(e, "Update failed"));
    } finally {
      setSaving(false);
    }
  }

  async function markAsDone() {
    setMarkingDone(true);
    try {
      await api.patch(basePath, { status: "completed", progress: 100 });
      toast.success(`${kind === "task" ? "Task" : "Milestone"} marked as done`);
      setConfirmDone(false);
      await reload();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not mark as done"));
    } finally {
      setMarkingDone(false);
    }
  }

  async function deleteTask() {
    setDeleting(true);
    try {
      await api.delete(basePath);
      toast.success("Task deleted");
      router.replace("/tasks");
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not delete task"));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        backHref={copy.back}
        backLabel={copy.backLabel}
        title={data.title}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <StatusBadge kind={kind} value={data.status} />
            <StatusBadge kind="priority" value={data.priority} />
            {data.is_overdue && <OverdueBadge />}
          </span>
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canEditMeta && (
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditOpen(true)}>
                Edit task
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                className="w-full border-red-200 text-red-700 hover:bg-red-50 sm:w-auto"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Delete
              </Button>
            )}
            {!locked && (
              <Button variant="gold" className="w-full sm:w-auto" onClick={() => setConfirmDone(true)}>
                <CheckCircle2 />
                Mark as Done
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">
                {data.description || <span className="text-ink-muted italic">No description provided.</span>}
              </p>
              <dl className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
                <div>
                  <dt className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
                    <FolderKanban className="size-3.5" /> Project
                  </dt>
                  <dd className="text-sm font-semibold text-navy">
                    {data.project ? (
                      <Link href={`/projects/${data.project.id}`} className="hover:text-gold-dark hover:underline">
                        {data.project.name}
                      </Link>
                    ) : (
                      "Personal"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
                    <CalendarDays className="size-3.5" /> Deadline
                  </dt>
                  <dd className={`text-sm font-semibold ${data.is_overdue ? "text-red-600" : "text-navy"}`}>
                    {formatDate(data.deadline)}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">Created</dt>
                  <dd className="text-sm font-semibold text-navy">{formatDate(data.created_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <CommentsPanel
            basePath={basePath}
            comments={data.comments}
            disabled={locked}
            onChange={reload}
          />
          <AttachmentsPanel
            basePath={basePath}
            attachments={data.attachments}
            disabled={locked}
            onChange={reload}
          />
        </div>

        <div className="space-y-6">
          <Card className="xl:sticky xl:top-[92px]">
            <CardHeader>
              <CardTitle>Update progress</CardTitle>
              <CardDescription>
                {locked
                  ? `This ${copy.noun} is completed.`
                  : `Update status, or mark this ${copy.noun} as done when finished.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={locked}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPTIONS[kind].map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="progress">Progress</Label>
                  <span className="font-display text-2xl font-semibold text-navy tabular-nums">{progress}%</span>
                </div>
                <RangeSlider
                  id="progress"
                  value={progress}
                  onChange={(v) => {
                    setProgress(v);
                    if (v >= 100) setStatus("completed");
                  }}
                  disabled={locked}
                />
                <div className="flex justify-between text-[11px] font-medium text-ink-muted">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100% = Done</span>
                </div>
              </div>

              <Button className="w-full" onClick={save} loading={saving} disabled={locked || !dirty}>
                <Save />
                Save changes
              </Button>
              {!locked && (
                <Button variant="gold" className="w-full" onClick={() => setConfirmDone(true)}>
                  <CheckCircle2 />
                  Mark as Done
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {kind === "task" && (
        <TaskFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          projects={projects.data ?? []}
          task={data as Task}
          onSaved={() => void reload()}
        />
      )}

      <ConfirmDialog
        open={confirmDone}
        onOpenChange={setConfirmDone}
        title={`Mark ${copy.noun} as done?`}
        description={`Progress will be set to 100% and the ${copy.noun} will be marked completed.`}
        confirmLabel="Mark as Done"
        loading={markingDone}
        onConfirm={markAsDone}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description="This cannot be undone. Comments and attachments on the task will also be removed."
        confirmLabel="Delete task"
        destructive
        loading={deleting}
        onConfirm={deleteTask}
      />
    </div>
  );
}
