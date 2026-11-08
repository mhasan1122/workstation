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
import type { Project, ProjectDetail } from "@/types";

const schema = z
  .object({
    name: z.string().trim().min(1, "Project name is required").max(200),
    description: z.string().max(5000).optional(),
    start_date: z.string().nullable().optional(),
    deadline: z.string().nullable().optional(),
    status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]),
  })
  .refine(
    (v) => !v.start_date || !v.deadline || v.deadline >= v.start_date,
    { message: "Deadline cannot be before start date", path: ["deadline"] },
  );

type FormValues = z.infer<typeof schema>;

function blankForm(): FormValues {
  return {
    name: "",
    description: "",
    start_date: null,
    deadline: null,
    status: "planning",
  };
}

function valuesFromProject(project?: Project | null): FormValues {
  if (!project) return blankForm();
  return {
    name: project.name,
    description: project.description ?? "",
    start_date: project.start_date,
    deadline: project.deadline,
    status: project.status,
  };
}

export function ProjectFormDialog({
  project,
  onSaved,
  onCreated,
  triggerLabel,
  triggerClassName,
  triggerVariant = "gold",
  open: controlledOpen,
  onOpenChange,
}: {
  project?: Project | null;
  onSaved?: (project: ProjectDetail) => void;
  onCreated?: (project: ProjectDetail) => void;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "gold" | "outline" | "ghost";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!project;
  const notify = onSaved ?? onCreated;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valuesFromProject(project),
  });

  useEffect(() => {
    if (open) reset(valuesFromProject(project));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id, project?.name, project?.status, project?.deadline, project?.start_date]);

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit && project) {
        const body: Record<string, unknown> = {
          name: values.name,
          description: values.description?.trim() || null,
          status: values.status,
        };
        if (values.start_date) body.start_date = values.start_date;
        else body.clear_start_date = true;
        if (values.deadline) body.deadline = values.deadline;
        else body.clear_deadline = true;

        const { data } = await api.patch<ProjectDetail>(`/api/projects/${project.id}`, body);
        toast.success("Project updated");
        setOpen(false);
        notify?.(data);
      } else {
        const { data } = await api.post<ProjectDetail>("/api/projects", {
          name: values.name,
          description: values.description?.trim() || null,
          start_date: values.start_date || null,
          deadline: values.deadline || null,
          status: values.status,
        });
        toast.success("Project created");
        setOpen(false);
        reset(blankForm());
        notify?.(data);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, isEdit ? "Could not update project" : "Could not create project"));
    }
  }

  const label = triggerLabel ?? (isEdit ? "Edit" : "Create Project");

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
          <DialogTitle>{isEdit ? "Edit Project" : "Create Project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update name, dates, status or description."
              : "Set start and deadline dates from the calendar. You will be added as a project member."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input id="project-name" placeholder="e.g. Client Portal Redesign" {...register("name")} />
            {errors.name && <p className="text-xs font-medium text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea id="project-desc" placeholder="Optional overview…" {...register("description")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Controller
                control={control}
                name="start_date"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="Pick start date" />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Controller
                control={control}
                name="deadline"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="Pick deadline" />
                )}
              />
              {errors.deadline && (
                <p className="text-xs font-medium text-destructive">{errors.deadline.message}</p>
              )}
            </div>
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
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" loading={isSubmitting}>
              {isEdit ? "Save changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateProjectDialog(props: Omit<ComponentProps<typeof ProjectFormDialog>, "project">) {
  return <ProjectFormDialog {...props} />;
}
