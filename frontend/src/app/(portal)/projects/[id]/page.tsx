"use client";

import { CalendarClock, CalendarDays, ListChecks, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/progress-bits";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/shared/states";
import { OverdueBadge, StatusBadge } from "@/components/shared/status-badge";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/use-fetch";
import { api, getErrorMessage, pictureUrl } from "@/lib/api";
import { formatDate, initials } from "@/lib/utils";
import type { ProjectDetail, ProjectListItem } from "@/types";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, reload } = useFetch<ProjectDetail>(`/api/projects/${id}`);
  const projects = useFetch<ProjectListItem[]>("/api/projects");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading && !data) return <PageSkeleton />;
  if (error && !data)
    return (
      <Card>
        <ErrorState message={error} onRetry={reload} />
      </Card>
    );
  if (!data) return null;

  async function deleteProject() {
    setDeleting(true);
    try {
      await api.delete(`/api/projects/${id}`);
      toast.success("Project deleted");
      router.replace("/projects");
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not delete project"));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const projectOptions: ProjectListItem[] =
    projects.data?.length
      ? projects.data
      : [
          {
            id: data.id,
            name: data.name,
            description: data.description,
            start_date: data.start_date,
            deadline: data.deadline,
            status: data.status,
            overall_progress: data.overall_progress,
            created_by: data.created_by,
            created_at: data.created_at,
            member_count: data.members.length,
            my_tasks_total: data.my_tasks_total,
            my_tasks_completed: data.my_tasks_completed,
            my_progress: data.my_progress,
          },
        ];

  return (
    <div className="animate-fade-up">
      <PageHeader
        backHref="/projects"
        backLabel="All projects"
        title={data.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <StatusBadge kind="project" value={data.status} />
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {formatDate(data.start_date)} → {formatDate(data.deadline)}
            </span>
          </span>
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditOpen(true)}>
              Edit project
            </Button>
            <Button
              variant="outline"
              className="w-full border-red-200 text-red-700 hover:bg-red-50 sm:w-auto"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
              Delete
            </Button>
            <CreateTaskDialog
              projects={projectOptions}
              defaultProjectId={String(data.id)}
              lockProject
              triggerLabel="Add Task"
              onCreated={() => void reload()}
            />
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About this project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">
                {data.description || <span className="text-ink-muted italic">No description provided.</span>}
              </p>
              <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
                    Overall progress
                  </p>
                  <ProgressBar value={data.overall_progress} />
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
                    My progress · {data.my_tasks_completed}/{data.my_tasks_total} tasks
                  </p>
                  <ProgressBar value={data.my_progress} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tasks">
            <TabsList>
              <TabsTrigger value="tasks">
                <ListChecks /> My tasks ({data.my_tasks.length})
              </TabsTrigger>
              <TabsTrigger value="milestones">
                <CalendarClock /> My milestones ({data.my_milestones.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tasks">
              <Card className="overflow-hidden">
                {data.my_tasks.length === 0 ? (
                  <EmptyState
                    icon={ListChecks}
                    title="No tasks in this project"
                    description="Use Add Task to create one under this project."
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {data.my_tasks.map((t) => (
                      <li key={t.id}>
                        <Link href={`/tasks/${t.id}`} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-accent/60 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-navy">{t.title}</p>
                            <p className="text-xs text-ink-muted">Due {formatDate(t.deadline)}</p>
                          </div>
                          <ProgressBar value={t.progress} overdue={t.is_overdue} className="w-full sm:w-36" />
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {t.is_overdue && <OverdueBadge />}
                            <StatusBadge kind="priority" value={t.priority} />
                            <StatusBadge kind="task" value={t.status} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="milestones">
              <Card className="overflow-hidden">
                {data.my_milestones.length === 0 ? (
                  <EmptyState icon={CalendarClock} title="No milestones in this project" />
                ) : (
                  <ul className="divide-y divide-line">
                    {data.my_milestones.map((m) => (
                      <li key={m.id}>
                        <Link href={`/milestones/${m.id}`} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-accent/60 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-navy">{m.title}</p>
                            <p className="text-xs text-ink-muted">Due {formatDate(m.deadline)}</p>
                          </div>
                          <ProgressBar value={m.progress} overdue={m.is_overdue} className="w-full sm:w-36" />
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {m.is_overdue && <OverdueBadge />}
                            <StatusBadge kind="milestone" value={m.status} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>
              {data.members.length} {data.members.length === 1 ? "member" : "members"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.members.length === 0 ? (
              <EmptyState compact title="No members listed" />
            ) : (
              <ul className="space-y-3.5">
                {data.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarImage src={pictureUrl(m.profile_picture)} alt="" />
                      <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">{m.full_name}</p>
                      <p className="text-xs capitalize text-ink-muted">{m.role}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={data}
        onSaved={() => {
          setEditOpen(false);
          void reload();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this project?"
        description={`"${data.name}" will be removed. Daily reports, tasks and milestones are kept — only the project link is cleared.`}
        confirmLabel="Delete project"
        destructive
        loading={deleting}
        onConfirm={deleteProject}
      />
    </div>
  );
}
