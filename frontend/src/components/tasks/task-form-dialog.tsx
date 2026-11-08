"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import type { ProjectListItem, Task } from "@/types";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  deadline: z.string().nullable().optional(),
  project_id: z.string(),
  status: z.enum(["todo", "in_progress", "on_hold", "completed"]),
});

type FormValues = z.infer<typeof schema>;

export function TaskFormDialog({
  projects,
  task,
  onSaved,
  onCreated,
  defaultDeadline,
  defaultProjectId,
  lockProject = false,
  triggerLabel,
  triggerClassName,
  triggerVariant = "gold",
  open: controlledOpen,
  onOpenChange,
}: {
  projects: ProjectListItem[];
  task?: Task | null;
  onSaved?: (task: Task) => void;
  onCreated?: (task: Task) => void;
  defaultDeadline?: string | null;
  defaultProjectId?: string | null;
  lockProject?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "gold" | "outline" | "ghost";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const notify = onSaved ?? onCreated;
  const isEdit = !!task;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const lockedProjectId =
    lockProject && defaultProjectId && defaultProjectId !== "all" ? defaultProjectId : null;

  function valuesFromTask(t?: Task | null): FormValues {
    if (t) {
      return {
        title: t.title,
        description: t.description ?? "",
        priority: t.priority,
        deadline: t.deadline,
        project_id: t.project_id ? String(t.project_id) : "none",
        status: t.status === "in_review" ? "in_progress" : (t.status as FormValues["status"]),
      };
    }
    return {
      title: "",
      description: "",
      priority: "medium",
      deadline: defaultDeadline ?? null,
      project_id: lockedProjectId
        ? lockedProjectId
        : defaultProjectId && defaultProjectId !== "all"
          ? defaultProjectId
          : "none",
      status: "todo",
    };
  }

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valuesFromTask(task),
  });

  useEffect(() => {
    if (open) reset(valuesFromTask(task));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id, task?.updated_at]);

  async function onSubmit(values: FormValues) {
    const projectId = values.project_id === "none" ? null : Number(values.project_id);
    try {
      if (isEdit && task) {
        const body: Record<string, unknown> = {
          title: values.title,
          description: values.description?.trim() || null,
          priority: values.priority,
          status: values.status,
        };
        if (values.deadline) body.deadline = values.deadline;
        else body.clear_deadline = true;
        if (projectId !== null) body.project_id = projectId;
        else body.clear_project = true;

        const { data } = await api.patch<Task>(`/api/tasks/${task.id}`, body);
        toast.success("Task updated");
        setOpen(false);
        notify?.(data);
      } else {
        const { data } = await api.post<Task>("/api/tasks", {
          title: values.title,
          description: values.description?.trim() || null,
          priority: values.priority,
          deadline: values.deadline || null,
          project_id: projectId,
          status: values.status === "completed" ? "todo" : values.status,
        });
        toast.success("Task created");
        setOpen(false);
        reset(valuesFromTask(null));
        notify?.(data);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, isEdit ? "Could not update task" : "Could not create task"));
    }
  }

  const label = triggerLabel ?? (isEdit ? "Edit" : "Add Task");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant={triggerVariant} className={triggerClassName ?? "w-full sm:w-auto"}>
            {isEdit ? <Pencil /> : <Plus />}
            {label}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "Add Task"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update title, project, deadline, priority or status."
              : lockedProjectId
                ? "This task will be added to the current project and assigned to you."
                : "Create a task with a deadline. Pick a project to show it under that project."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" placeholder="What needs to be done?" {...register("title")} />
            {errors.title && <p className="text-xs font-medium text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea id="task-desc" placeholder="Optional details…" {...register("description")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Controller
                control={control}
                name="deadline"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="Pick deadline" />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Project</Label>
              {lockedProjectId && !isEdit ? (
                <>
                  <input type="hidden" {...register("project_id")} />
                  <div className="flex h-10 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-navy">
                    {projects.find((p) => String(p.id) === lockedProjectId)?.name ?? `Project #${lockedProjectId}`}
                  </div>
                </>
              ) : (
                <Controller
                  control={control}
                  name="project_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Personal (no project)</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      {isEdit && <SelectItem value="completed">Done</SelectItem>}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" loading={isSubmitting}>
              {isEdit ? "Save changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Back-compat alias used by tasks / project pages. */
export function CreateTaskDialog(props: Omit<ComponentProps<typeof TaskFormDialog>, "task">) {
  return <TaskFormDialog {...props} />;
}
