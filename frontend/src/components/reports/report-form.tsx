"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  FileText,
  MessageSquareQuote,
  Paperclip,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFetch } from "@/hooks/use-fetch";
import { api, assetUrl, getErrorMessage } from "@/lib/api";
import { cn, formatDate, formatHours, todayISO } from "@/lib/utils";
import type {
  ProjectListItem,
  Report,
  ReportAttachment,
  ReportEntryInput,
  Task,
  WorkStatus,
} from "@/types";

const WORK_STATUSES: { value: WorkStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
];

const entrySchema = z.object({
  task_title: z.string().trim().min(1, "Task title is required").max(255, "Max 255 characters"),
  work_description: z.string().trim().min(1, "Describe the work you did").max(10000),
  project_id: z.string(),
  related_task_id: z.string(),
  time_spent_hours: z
    .number({ error: "Enter hours spent" })
    .min(0, "Cannot be negative")
    .max(24, "Max 24 hours"),
  work_status: z.enum(["not_started", "in_progress", "completed", "blocked"]),
  achievement: z.string().max(5000),
  challenges: z.string().max(5000),
  next_day_plan: z.string().max(5000),
});

const schema = z
  .object({
    report_date: z.string().min(1, "Select a date"),
    entries: z.array(entrySchema).min(1, "Add at least one work entry"),
    response_message: z.string(),
  })
  .refine((v) => v.entries.reduce((s, e) => s + (Number.isFinite(e.time_spent_hours) ? e.time_spent_hours : 0), 0) <= 24, {
    path: ["entries"],
    message: "Total time across all entries cannot exceed 24 hours",
  });

type FormValues = z.infer<typeof schema>;
type EntryValues = FormValues["entries"][number];

const blankEntry = (): EntryValues => ({
  task_title: "",
  work_description: "",
  project_id: "none",
  related_task_id: "none",
  time_spent_hours: 1,
  work_status: "in_progress",
  achievement: "",
  challenges: "",
  next_day_plan: "",
});

function toPayload(e: EntryValues): ReportEntryInput {
  return {
    task_title: e.task_title.trim(),
    work_description: e.work_description.trim(),
    project_id: e.project_id === "none" ? null : Number(e.project_id),
    related_task_id: e.related_task_id === "none" ? null : Number(e.related_task_id),
    time_spent_hours: e.time_spent_hours,
    work_status: e.work_status,
    achievement: e.achievement.trim() || null,
    challenges: e.challenges.trim() || null,
    next_day_plan: e.next_day_plan.trim() || null,
  };
}

function entryFromSuggested(e: ReportEntryInput): EntryValues {
  return {
    task_title: e.task_title,
    work_description: e.work_description,
    project_id: e.project_id ? String(e.project_id) : "none",
    related_task_id: e.related_task_id ? String(e.related_task_id) : "none",
    time_spent_hours: e.time_spent_hours ?? 0,
    work_status: e.work_status,
    achievement: e.achievement ?? "",
    challenges: e.challenges ?? "",
    next_day_plan: e.next_day_plan ?? "",
  };
}

function defaultsFromReport(report?: Report): FormValues {
  if (!report) {
    return { report_date: todayISO(), entries: [blankEntry()], response_message: "" };
  }
  return {
    report_date: report.report_date,
    response_message: report.employee_response ?? "",
    entries: report.entries.length
      ? report.entries.map((e) => entryFromSuggested(e))
      : [blankEntry()],
  };
}

export function ReportForm({ report }: { report?: Report }) {
  const router = useRouter();
  const { user } = useAuth();
  const isRevision = report?.status === "revision_requested";

  const projects = useFetch<ProjectListItem[]>("/api/projects");
  const tasks = useFetch<Task[]>("/api/tasks", { limit: 500 });
  const suggested = useFetch<ReportEntryInput[]>(
    report && report.entries.length > 0 ? null : "/api/reports/suggested-entries",
  );

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFromReport(report),
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "entries" });
  const watchedEntries = useWatch({ control, name: "entries" });
  const totalHours = useMemo(
    () =>
      (watchedEntries ?? []).reduce(
        (s, e) => s + (Number.isFinite(e?.time_spent_hours) ? Number(e.time_spent_hours) : 0),
        0,
      ),
    [watchedEntries],
  );

  const [reportId, setReportId] = useState<number | undefined>(report?.id);
  const [existingFiles, setExistingFiles] = useState<ReportAttachment[]>(report?.attachments ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<"draft" | "submit" | "delete" | "sync" | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = todayISO();

  // New / empty report → auto-fill entries from tasks, project-wise.
  useEffect(() => {
    if (seeded || !suggested.data?.length) return;
    if (report && report.entries.length > 0) return;
    const current = getValues("entries");
    const blank =
      !current?.length ||
      (current.length === 1 && !current[0].task_title.trim() && !current[0].work_description.trim());
    if (!blank) {
      setSeeded(true);
      return;
    }
    replace(suggested.data.map(entryFromSuggested));
    setSeeded(true);
    toast.message("Tasks loaded into this report", {
      description: "Entries are grouped by project. Add hours, then save or submit.",
    });
  }, [suggested.data, report, seeded, getValues, replace]);

  async function syncFromTasks() {
    setBusy("sync");
    try {
      const { data } = await api.get<ReportEntryInput[]>("/api/reports/suggested-entries");
      if (!data.length) {
        toast.message("No tasks found to import");
        return;
      }
      replace(data.map(entryFromSuggested));
      setSeeded(true);
      toast.success(`${data.length} task${data.length === 1 ? "" : "s"} loaded (project-wise)`);
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not load tasks"));
    } finally {
      setBusy(null);
    }
  }

  async function uploadPending(id: number) {
    const uploaded: ReportAttachment[] = [];
    for (const file of pendingFiles) {
      const form = new FormData();
      form.append("file", file);
      try {
        const { data } = await api.post<ReportAttachment>(`/api/reports/${id}/attachments`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploaded.push(data);
      } catch (e) {
        toast.error(`${file.name}: ${getErrorMessage(e, "Upload failed")}`);
      }
    }
    setPendingFiles([]);
    if (uploaded.length) setExistingFiles((prev) => [...prev, ...uploaded]);
  }

  /** Create or update the draft. Returns the report id. */
  async function persist(values: FormValues): Promise<number> {
    const body = { report_date: values.report_date, entries: values.entries.map(toPayload) };
    if (reportId) {
      // Date of a revision cannot be changed; keep payload to entries only.
      const putBody = isRevision ? { entries: body.entries } : body;
      await api.put<Report>(`/api/reports/${reportId}`, putBody);
      return reportId;
    }
    const { data } = await api.post<Report>("/api/reports", body);
    setReportId(data.id);
    return data.id;
  }

  async function saveDraft(values: FormValues) {
    setBusy("draft");
    let id: number | undefined = reportId;
    try {
      id = await persist(values);
      await uploadPending(id);
      toast.success(isRevision ? "Changes saved" : "Draft saved");
      if (!report) router.replace(`/reports/${id}/edit`);
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not save the report"));
      if (id && !report) router.replace(`/reports/${id}/edit`);
    } finally {
      setBusy(null);
    }
  }

  async function submitReport() {
    const values = getValues();
    setBusy("submit");
    let id: number | undefined = reportId;
    try {
      id = await persist(values);
      await uploadPending(id);
      if (isRevision) {
        await api.post(`/api/reports/${id}/respond-revision`, {
          message: values.response_message.trim(),
          entries: values.entries.map(toPayload),
        });
        toast.success("Revision submitted for review");
      } else {
        await api.post(`/api/reports/${id}/submit`);
        toast.success("Report submitted");
      }
      setConfirmSubmit(false);
      router.replace(`/reports/${id}`);
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not submit the report"));
      setConfirmSubmit(false);
      if (id && !report) router.replace(`/reports/${id}/edit`);
    } finally {
      setBusy(null);
    }
  }

  function onSubmitClick(values: FormValues) {
    if (isRevision && !values.response_message.trim()) {
      setError("response_message", { message: "Please describe what you changed in response to the feedback" });
      return;
    }
    setConfirmSubmit(true);
  }

  async function deleteDraft() {
    if (!reportId) return;
    setBusy("delete");
    try {
      await api.delete(`/api/reports/${reportId}`);
      toast.success("Draft deleted");
      router.replace("/reports");
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not delete draft"));
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  async function removeExisting(att: ReportAttachment) {
    try {
      await api.delete(`/api/reports/${att.report_id}/attachments/${att.id}`);
      setExistingFiles((prev) => prev.filter((a) => a.id !== att.id));
      toast.success("Attachment removed");
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not remove attachment"));
    }
  }

  const entriesError = errors.entries as { message?: string; root?: { message?: string } } | undefined;
  const entriesMsg = entriesError?.root?.message ?? entriesError?.message;

  return (
    <form onSubmit={(ev) => ev.preventDefault()} noValidate className="space-y-6" id="report-form">
      {/* Revision banner */}
      {isRevision && report && (
        <Card className="border-red-200 bg-red-50/60">
          <CardContent className="flex gap-3 pt-5">
            <MessageSquareQuote className="mt-0.5 size-5 shrink-0 text-red-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-800">Revision requested</p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-red-900/90">
                {report.admin_feedback || "Your reviewer asked for changes to this report."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee info */}
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Report details</CardTitle>
            <CardDescription>Your details are filled in automatically.</CardDescription>
          </div>
          {report && <StatusBadge kind="report" value={report.status} />}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ReadOnlyField icon={UserIcon} label="Employee" value={user.full_name} />
            <ReadOnlyField icon={Building2} label="Department" value={user.department ?? "—"} />
            <div className="space-y-1.5">
              <Label htmlFor="report_date">
                <CalendarDays className="size-3.5 text-ink-muted" /> Report date
              </Label>
              <Input
                id="report_date"
                type="date"
                max={today}
                readOnly={isRevision}
                aria-invalid={!!errors.report_date}
                {...register("report_date")}
              />
              {errors.report_date && <p className="text-xs text-destructive">{errors.report_date.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-navy">Work entries</h2>
            <p className="text-[13px] text-ink-muted">
              Your tasks (done, in progress, etc.) load here automatically, grouped by project.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void syncFromTasks()}
              loading={busy === "sync"}
              disabled={!!busy && busy !== "sync"}
            >
              Sync from tasks
            </Button>
            <div
              className={cn(
                "rounded-lg border px-3.5 py-2 text-right",
                totalHours > 24 ? "border-red-200 bg-red-50" : "border-line bg-white",
              )}
            >
              <p className="text-[10px] font-bold tracking-[0.1em] text-ink-muted uppercase">Total time</p>
              <p className={cn("font-display text-xl font-semibold", totalHours > 24 ? "text-red-600" : "text-navy")}>
                {formatHours(totalHours)}
              </p>
            </div>
          </div>
        </div>

        {fields.map((field, index) => (
          <EntryCard
            key={field.id}
            index={index}
            control={control}
            register={register}
            errors={errors}
            canRemove={fields.length > 1}
            onRemove={() => remove(index)}
            projects={projects.data ?? []}
            tasks={tasks.data ?? []}
          />
        ))}

        {entriesMsg && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="size-4" />
            {entriesMsg}
          </p>
        )}

        <Button type="button" variant="outline" onClick={() => append(blankEntry())} className="w-full border-dashed py-6">
          <Plus />
          Add another entry
        </Button>
      </div>

      {/* Attachments */}
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="size-4 text-gold-dark" /> Attachments
            </CardTitle>
            <CardDescription>Optional supporting files, uploaded when you save.</CardDescription>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) setPendingFiles((p) => [...p, ...files]);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> Add files
          </Button>
        </CardHeader>
        <CardContent>
          {existingFiles.length === 0 && pendingFiles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
              No files attached.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {existingFiles.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <FileText className="size-4 shrink-0 text-navy" />
                  <a
                    href={assetUrl(a.url ?? `/uploads/${a.file_path}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm font-semibold text-navy hover:text-gold-dark hover:underline"
                  >
                    {a.filename}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeExisting(a)}
                    className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${a.filename}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
              {pendingFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gold-soft/30 px-3.5 py-2.5">
                  <FileText className="size-4 shrink-0 text-gold-dark" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.name}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{(f.size / 1024).toFixed(0)} KB · pending</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((p) => p.filter((_, idx) => idx !== i))}
                    className="rounded p-1 text-ink-muted hover:bg-accent hover:text-navy"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Revision response */}
      {isRevision && (
        <Card>
          <CardHeader>
            <CardTitle>Your response</CardTitle>
            <CardDescription>Explain what you changed so your reviewer can approve quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              placeholder="Describe the changes you made in response to the feedback…"
              aria-invalid={!!errors.response_message}
              {...register("response_message")}
            />
            {errors.response_message && <p className="text-xs text-destructive">{errors.response_message.message}</p>}
          </CardContent>
        </Card>
      )}

      {/* Action bar */}
      <div className="safe-pb sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border border-line bg-white/95 px-3 py-4 shadow-pop backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="text-[13px] text-ink-muted">
          {report ? (
            <>
              Report for <span className="font-semibold text-navy">{formatDate(report.report_date)}</span>
            </>
          ) : (
            "Save as a draft to continue later, or submit when ready."
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {report?.status === "draft" && (
            <Button type="button" variant="ghost" className="w-full text-destructive hover:bg-red-50 hover:text-destructive sm:w-auto" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
              <Trash2 /> Delete draft
            </Button>
          )}
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleSubmit(saveDraft)} loading={busy === "draft"} disabled={!!busy && busy !== "draft"}>
            <Save /> {isRevision ? "Save changes" : "Save draft"}
          </Button>
          <Button type="button" variant="gold" className="w-full sm:w-auto" onClick={handleSubmit(onSubmitClick)} disabled={!!busy}>
            <Send /> {isRevision ? "Resubmit report" : "Submit report"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title={isRevision ? "Resubmit this report?" : "Submit this report?"}
        description={`Total time logged is ${formatHours(totalHours)}. Once submitted, the report is sent for review and can no longer be edited${isRevision ? " until the next revision request" : ""}.`}
        confirmLabel={isRevision ? "Resubmit" : "Submit report"}
        loading={busy === "submit"}
        onConfirm={submitReport}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this draft?"
        description="This permanently removes the draft report and its attachments."
        confirmLabel="Delete draft"
        destructive
        loading={busy === "delete"}
        onConfirm={deleteDraft}
      />
    </form>
  );
}

function ReadOnlyField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        <Icon className="size-3.5 text-ink-muted" /> {label}
      </Label>
      <div className="flex h-10 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-navy">
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function EntryCard({
  index,
  control,
  register,
  errors,
  canRemove,
  onRemove,
  projects,
  tasks,
}: {
  index: number;
  control: Control<FormValues>;
  register: ReturnType<typeof useForm<FormValues>>["register"];
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"];
  canRemove: boolean;
  onRemove: () => void;
  projects: ProjectListItem[];
  tasks: Task[];
}) {
  const projectId = useWatch({ control, name: `entries.${index}.project_id` });
  const e = errors.entries?.[index];
  const taskOptions = projectId && projectId !== "none" ? tasks.filter((t) => String(t.project_id) === projectId) : tasks;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-surface/70 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-gold">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-navy">Entry {index + 1}</span>
        </div>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-ink-muted hover:bg-red-50 hover:text-red-600">
            <Trash2 /> Remove
          </Button>
        )}
      </div>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor={`title-${index}`}>Task / work title *</Label>
            <Input id={`title-${index}`} placeholder="e.g. Build login form validation" aria-invalid={!!e?.task_title} {...register(`entries.${index}.task_title`)} />
            {e?.task_title && <p className="text-xs text-destructive">{e.task_title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`hours-${index}`}>Time spent (hours) *</Label>
            <Input
              id={`hours-${index}`}
              type="number"
              step="0.25"
              min={0}
              max={24}
              inputMode="decimal"
              aria-invalid={!!e?.time_spent_hours}
              {...register(`entries.${index}.time_spent_hours`, { valueAsNumber: true })}
            />
            {e?.time_spent_hours && <p className="text-xs text-destructive">{e.time_spent_hours.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Work status</Label>
            <Controller
              control={control}
              name={`entries.${index}.work_status`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Controller
              control={control}
              name={`entries.${index}.project_id`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Related task</Label>
            <Controller
              control={control}
              name={`entries.${index}.related_task_id`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No related task</SelectItem>
                    {taskOptions.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`desc-${index}`}>Work description *</Label>
          <Textarea id={`desc-${index}`} placeholder="What did you work on?" className="min-h-[104px]" aria-invalid={!!e?.work_description} {...register(`entries.${index}.work_description`)} />
          {e?.work_description && <p className="text-xs text-destructive">{e.work_description.message}</p>}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`ach-${index}`}>Achievements</Label>
            <Textarea id={`ach-${index}`} placeholder="What went well?" {...register(`entries.${index}.achievement`)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`chal-${index}`}>Challenges</Label>
            <Textarea id={`chal-${index}`} placeholder="Any blockers or issues?" {...register(`entries.${index}.challenges`)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`next-${index}`}>Next-day plan</Label>
            <Textarea id={`next-${index}`} placeholder="What's next?" {...register(`entries.${index}.next_day_plan`)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
