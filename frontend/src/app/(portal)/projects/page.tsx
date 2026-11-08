"use client";

import { CalendarDays, CheckCircle2, FolderKanban, Pencil, Search, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CreateProjectDialog, ProjectFormDialog } from "@/components/projects/create-project-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/progress-bits";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounced, useFetch } from "@/hooks/use-fetch";
import { api, getErrorMessage } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { ProjectListItem } from "@/types";

export default function ProjectsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const debounced = useDebounced(search);
  const params = useMemo(
    () => ({ search: debounced.trim() || undefined, status: status === "all" ? undefined : status }),
    [debounced, status],
  );
  const { data, loading, error, reload, setData } = useFetch<ProjectListItem[]>("/api/projects", params);
  const filtered = !!(search || status !== "all");
  const [editProject, setEditProject] = useState<ProjectListItem | null>(null);
  const [deleteProject, setDeleteProject] = useState<ProjectListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteProject) return;
    setDeleting(true);
    try {
      await api.delete(`/api/projects/${deleteProject.id}`);
      toast.success("Project deleted");
      setData((prev) => (prev ?? []).filter((p) => p.id !== deleteProject.id));
      setDeleteProject(null);
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not delete project"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="My Projects"
        description="Create a project with start/deadline dates, or open one you belong to."
        actions={
          <CreateProjectDialog
            onCreated={(project) => {
              void reload();
              router.push(`/projects/${project.id}`);
            }}
          />
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search projects"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <CardGridSkeleton />
      ) : error && !data ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={filtered ? "No projects match your filters" : "No projects yet"}
            description={
              filtered
                ? "Try a different search or status."
                : "Create your first project with Create Project."
            }
          />
        </Card>
      ) : (
        <div className={cn("grid gap-5 sm:grid-cols-2 xl:grid-cols-3", loading && "opacity-60")}>
          {data.map((p) => (
            <Card
              key={p.id}
              className="group flex h-full flex-col gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-pop"
            >
              <Link href={`/projects/${p.id}`} className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy text-gold">
                    <FolderKanban className="size-5" />
                  </div>
                  <StatusBadge kind="project" value={p.status} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-semibold text-navy group-hover:text-gold-dark">{p.name}</h3>
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">
                    {p.description || "No description provided."}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                      <span>Overall</span>
                    </div>
                    <ProgressBar value={p.overall_progress} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                      <span>My progress</span>
                    </div>
                    <ProgressBar value={p.my_progress} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3.5 text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    {p.my_tasks_completed}/{p.my_tasks_total} tasks
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {p.member_count}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    {formatDate(p.deadline)}
                  </span>
                </div>
              </Link>
              <div className="flex gap-2 border-t border-line pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditProject(p)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteProject(p)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={!!editProject}
        onOpenChange={(o) => !o && setEditProject(null)}
        project={editProject}
        onSaved={(updated) => {
          setData((prev) =>
            (prev ?? []).map((p) =>
              p.id === updated.id
                ? {
                    ...p,
                    name: updated.name,
                    description: updated.description,
                    start_date: updated.start_date,
                    deadline: updated.deadline,
                    status: updated.status,
                    overall_progress: updated.overall_progress,
                  }
                : p,
            ),
          );
          setEditProject(null);
        }}
      />
      <ConfirmDialog
        open={!!deleteProject}
        onOpenChange={(o) => !o && setDeleteProject(null)}
        title="Delete this project?"
        description={
          deleteProject
            ? `"${deleteProject.name}" will be removed. Daily reports and tasks are kept.`
            : "This project will be removed. Reports and tasks are kept."
        }
        confirmLabel="Delete project"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
