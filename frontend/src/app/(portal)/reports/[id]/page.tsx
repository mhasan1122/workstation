"use client";

import {
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  ListChecks,
  MessageSquareQuote,
  Paperclip,
  Pencil,
  Reply,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, PageSkeleton } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFetch } from "@/hooks/use-fetch";
import { api, assetUrl, getErrorMessage } from "@/lib/api";
import { downloadExport } from "@/lib/download";
import { formatDate, formatDateTime, formatHours } from "@/lib/utils";
import type { Report, ReportEntry } from "@/types";

function Block({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
      <p className="text-sm whitespace-pre-wrap text-ink">{text}</p>
    </div>
  );
}

function EntryView({ entry, index }: { entry: ReportEntry; index: number }) {
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-gold">
            {index + 1}
          </span>
          <div className="min-w-0">
            <CardTitle className="break-words">{entry.task_title}</CardTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              {(entry.project_label || entry.project?.name || entry.project_name) && (
                <span className="inline-flex items-center gap-1">
                  <FolderKanban className="size-3.5" />
                  {entry.project_label || entry.project?.name || entry.project_name}
                </span>
              )}
              {entry.related_task && (
                <Link href={`/tasks/${entry.related_task.id}`} className="inline-flex items-center gap-1 hover:text-gold-dark hover:underline">
                  <ListChecks className="size-3.5" /> {entry.related_task.title}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col items-start gap-1.5 sm:w-auto sm:items-end">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy">
            <Clock className="size-4 text-gold-dark" /> {formatHours(entry.time_spent_hours)}
          </span>
          <StatusBadge kind="work" value={entry.work_status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Block label="Work description" text={entry.work_description} />
        <div className="grid gap-4 md:grid-cols-3">
          <Block label="Achievements" text={entry.achievement} />
          <Block label="Challenges" text={entry.challenges} />
          <Block label="Next-day plan" text={entry.next_day_plan} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, reload } = useFetch<Report>(`/api/reports/${id}`);

  const [message, setMessage] = useState("");
  const [responding, setResponding] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const entriesByProject = useMemo(() => {
    const map = new Map<string, { name: string; entries: ReportEntry[] }>();
    for (const entry of data?.entries ?? []) {
      const label = entry.project_label || entry.project?.name || entry.project_name || "Personal";
      const key =
        entry.project_id != null
          ? `p-${entry.project_id}`
          : entry.project_name
            ? `n-${entry.project_name}`
            : "personal";
      const bucket = map.get(key) ?? { name: label, entries: [] };
      bucket.entries.push(entry);
      map.set(key, bucket);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.name === "Personal") return 1;
      if (b.name === "Personal") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [data?.entries]);

  if (loading && !data) return <PageSkeleton />;
  if (error && !data)
    return (
      <Card>
        <ErrorState message={error} onRetry={reload} />
      </Card>
    );
  if (!data) return null;

  const isDraft = data.status === "draft";
  const isRevision = data.status === "revision_requested";

  async function submitDraft() {
    setBusy(true);
    try {
      await api.post(`/api/reports/${id}/submit`);
      toast.success("Report submitted");
      setConfirmSubmit(false);
      await reload();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not submit report"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    setBusy(true);
    try {
      await api.delete(`/api/reports/${id}`);
      toast.success("Draft deleted");
      router.replace("/reports");
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not delete draft"));
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  async function respond() {
    const text = message.trim();
    if (!text) {
      toast.error("Please write a response first");
      return;
    }
    setResponding(true);
    try {
      await api.post(`/api/reports/${id}/respond-revision`, { message: text });
      toast.success("Response sent and report resubmitted");
      setMessage("");
      await reload();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not send response"));
    } finally {
      setResponding(false);
    }
  }

  async function handleExport(kind: "pdf" | "excel") {
    setExporting(kind);
    try {
      await downloadExport(
        `/api/reports/export/${kind}`,
        { report_date: data!.report_date },
        `report-${data!.report_date}.${kind === "pdf" ? "pdf" : "xlsx"}`,
      );
      toast.success(kind === "pdf" ? "PDF downloaded" : "Excel downloaded");
    } catch (e) {
      toast.error(getErrorMessage(e, "Export failed"));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        backHref="/reports"
        backLabel="Report history"
        title={formatDate(data.report_date, "EEEE, MMMM d, yyyy")}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <StatusBadge kind="report" value={data.status} />
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> {formatHours(data.total_hours)} logged
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileText className="size-4" /> {data.entry_count} {data.entry_count === 1 ? "entry" : "entries"}
            </span>
            {data.submitted_at && <span>Submitted {formatDateTime(data.submitted_at)}</span>}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={exporting !== null}
              loading={exporting === "pdf"}
              onClick={() => void handleExport("pdf")}
            >
              <FileText /> Export PDF
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={exporting !== null}
              loading={exporting === "excel"}
              onClick={() => void handleExport("excel")}
            >
              <FileSpreadsheet /> Export Excel
            </Button>
            {isDraft && (
              <Button variant="ghost" className="w-full text-destructive hover:bg-red-50 hover:text-destructive sm:w-auto" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </Button>
            )}
            {data.is_editable && (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={`/reports/${data.id}/edit`}>
                  <Pencil /> {isRevision ? "Revise entries" : "Edit"}
                </Link>
              </Button>
            )}
            {isDraft && (
              <Button variant="gold" className="w-full sm:w-auto" onClick={() => setConfirmSubmit(true)} disabled={data.entry_count === 0}>
                <Send /> Submit
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6">
        {data.admin_feedback && (
          <Card className={isRevision ? "border-red-200 bg-red-50/50" : "border-gold/40 bg-gold-soft/40"}>
            <CardContent className="flex gap-3 pt-5">
              <MessageSquareQuote className={`mt-0.5 size-5 shrink-0 ${isRevision ? "text-red-600" : "text-gold-dark"}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">
                  {isRevision ? "Revision requested" : "Reviewer feedback"}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{data.admin_feedback}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.employee_response && (
          <Card>
            <CardContent className="flex gap-3 pt-5">
              <Reply className="mt-0.5 size-5 shrink-0 text-navy" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">Your response</p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{data.employee_response}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.status === "approved" && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="size-5" /> This report has been approved.
          </div>
        )}

        {isRevision && (
          <Card className="border-gold/40">
            <CardHeader>
              <CardTitle>Respond to revision request</CardTitle>
              <CardDescription>
                Send a reply to resubmit as-is, or{" "}
                <Link href={`/reports/${data.id}/edit`} className="font-semibold text-navy underline-offset-2 hover:text-gold-dark hover:underline">
                  revise the entries
                </Link>{" "}
                first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="response">Your response</Label>
              <Textarea
                id="response"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explain what you changed or clarify the points raised…"
                maxLength={5000}
              />
              <div className="flex flex-col sm:flex-row sm:justify-end">
                <Button variant="gold" className="w-full sm:w-auto" onClick={respond} loading={responding} disabled={!message.trim()}>
                  <Send /> Send response &amp; resubmit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-navy">Work entries</h2>
            <p className="mt-1 text-[13px] text-ink-muted">Grouped by project — each task listed individually.</p>
          </div>
          {data.entries.length === 0 ? (
            <Card className="p-8 text-center text-sm text-ink-muted">This report has no entries yet.</Card>
          ) : (
            entriesByProject.map((group) => {
              const hours = group.entries.reduce((s, e) => s + (e.time_spent_hours || 0), 0);
              return (
                <section key={group.name} className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FolderKanban className="size-4 shrink-0 text-gold-dark" />
                      <h3 className="font-display text-lg font-semibold text-navy">{group.name}</h3>
                    </div>
                    <p className="text-[13px] text-ink-muted">
                      {group.entries.length} {group.entries.length === 1 ? "task" : "tasks"} · {formatHours(hours)}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {group.entries.map((e, i) => (
                      <EntryView key={e.id} entry={e} index={i} />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {data.attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="size-4 text-gold-dark" /> Attachments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {data.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={assetUrl(a.url ?? `/uploads/${a.file_path}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-accent"
                    >
                      <FileText className="size-4 text-navy" />
                      <span className="truncate text-sm font-semibold text-navy">{a.filename}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title="Submit this report?"
        description="Once submitted the report is sent for review and can no longer be edited."
        confirmLabel="Submit report"
        loading={busy}
        onConfirm={submitDraft}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this draft?"
        description="This permanently removes the draft report and its attachments."
        confirmLabel="Delete draft"
        destructive
        loading={busy}
        onConfirm={deleteDraft}
      />
    </div>
  );
}
