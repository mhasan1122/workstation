"use client";

import { ChevronLeft, ChevronRight, FilePlus2, FileSpreadsheet, FileText, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounced, useFetch } from "@/hooks/use-fetch";
import { downloadExport, getErrorMessage } from "@/lib/download";
import { cn, formatDate, formatDateTime, formatHours } from "@/lib/utils";
import type { ProjectListItem, ReportList } from "@/types";

const PAGE_SIZE = 10;

export default function ReportHistoryPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const debounced = useDebounced(search);

  const params = useMemo(
    () => ({
      search: debounced.trim() || undefined,
      status: status === "all" ? undefined : status,
      project_id: projectId === "all" ? undefined : Number(projectId),
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [debounced, status, projectId, dateFrom, dateTo, page],
  );

  const { data, loading, error, reload } = useFetch<ReportList>("/api/reports", params);
  const projects = useFetch<ProjectListItem[]>("/api/projects");

  const hasFilters = !!(search || status !== "all" || projectId !== "all" || dateFrom || dateTo);
  const reset = () => {
    setSearch("");
    setStatus("all");
    setProjectId("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };
  // Any filter change returns to the first page.
  const withReset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const exportParams = useMemo(
    () => ({
      search: debounced.trim() || undefined,
      status: status === "all" ? undefined : status,
      project_id: projectId === "all" ? undefined : Number(projectId),
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [debounced, status, projectId, dateFrom, dateTo],
  );

  async function handleExport(kind: "pdf" | "excel") {
    setExporting(kind);
    try {
      await downloadExport(
        `/api/reports/export/${kind}`,
        exportParams,
        `report-history.${kind === "pdf" ? "pdf" : "xlsx"}`,
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
        title="Report History"
        description="Browse, search and review all of your daily work reports."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={exporting !== null}
              loading={exporting === "pdf"}
              onClick={() => void handleExport("pdf")}
            >
              <FileText />
              Export PDF
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={exporting !== null}
              loading={exporting === "excel"}
              onClick={() => void handleExport("excel")}
            >
              <FileSpreadsheet />
              Export Excel
            </Button>
            <Button asChild variant="gold" className="w-full sm:w-auto">
              <Link href="/reports/new">
                <FilePlus2 /> New report
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1.2fr_1fr_1fr_auto] xl:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="rep-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
              <Input
                id="rep-search"
                placeholder="Search work, achievements…"
                value={search}
                onChange={(e) => withReset(setSearch)(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={withReset(setStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="revision_requested">Revision Requested</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={withReset(setProjectId)}>
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
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => withReset(setDateFrom)(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => withReset(setDateTo)(e.target.value)} />
          </div>
          <Button variant="ghost" className="w-full sm:w-auto xl:w-auto" onClick={reset} disabled={!hasFilters}>
            <X /> Clear
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink-muted">
            Download filtered reports as PDF or Excel (charts included).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={exporting !== null}
              loading={exporting === "pdf"}
              onClick={() => void handleExport("pdf")}
            >
              <FileText />
              Export PDF
            </Button>
            <Button
              variant="gold"
              className="w-full sm:w-auto"
              disabled={exporting !== null}
              loading={exporting === "excel"}
              onClick={() => void handleExport("excel")}
            >
              <FileSpreadsheet />
              Export Excel
            </Button>
          </div>
        </div>
      </Card>

      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error && !data ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={hasFilters ? "No reports match your filters" : "No reports yet"}
            description={hasFilters ? "Try adjusting or clearing your filters." : "Your submitted daily reports will be listed here."}
            action={
              hasFilters ? (
                <Button variant="outline" onClick={reset}>Clear filters</Button>
              ) : (
                <Button asChild variant="gold">
                  <Link href="/reports/new">Create your first report</Link>
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className={cn("overflow-hidden transition-opacity", loading && "opacity-60")}>
          <div className="table-scroll">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/70 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
                  <th className="px-5 py-3">Report date</th>
                  <th className="px-3 py-3">Task names</th>
                  <th className="px-3 py-3">Hours</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((r) => (
                  <tr key={r.id} className="group transition-colors hover:bg-accent/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/reports/${r.id}`} className="block">
                        <p className="font-semibold text-navy group-hover:text-gold-dark">
                          {formatDate(r.report_date, "EEE, MMM d, yyyy")}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {r.entry_count} {r.entry_count === 1 ? "entry" : "entries"}
                        </p>
                      </Link>
                    </td>
                    <td className="max-w-[320px] px-3 py-3.5">
                      <Link href={`/reports/${r.id}`} className="block">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {r.entries.map((e) => e.task_title).filter(Boolean).join(" · ") || "—"}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {Array.from(
                            new Set(
                              r.entries
                                .map((e) => e.project_label || e.project?.name || e.project_name)
                                .filter((n): n is string => !!n),
                            ),
                          ).join(" · ") || "Personal"}
                        </p>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 font-medium text-ink">{formatHours(r.total_hours)}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge kind="report" value={r.status} />
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-muted">
                      {r.submitted_at ? formatDateTime(r.submitted_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3 sm:flex-row">
            <p className="text-[13px] text-ink-muted">
              Showing {data.offset + 1}–{data.offset + data.items.length} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft /> Prev
              </Button>
              <span className="px-2 text-[13px] font-semibold text-navy">
                {page + 1} / {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
