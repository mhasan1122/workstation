"use client";

import { Award, CalendarClock, CheckCircle2, ClipboardCheck, Clock, FileCheck2, FileSpreadsheet, FileText, ListChecks, Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/progress-bits";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/use-fetch";
import { downloadExport, getErrorMessage } from "@/lib/download";
import { cn, formatDate, formatHours, todayISO } from "@/lib/utils";
import type { Performance, PerformancePeriod } from "@/types";

const PERIODS: { value: PerformancePeriod; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid #E8EEF5",
  boxShadow: "0 10px 30px -8px rgba(11,37,69,0.18)",
  fontSize: 12,
};
const AXIS = { fill: "#5B6B82", fontSize: 12 };
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#DC2626",
  high: "#F59E0B",
  medium: "#0EA5E9",
  low: "#94A3B8",
};
const STATUS_COLORS = ["#10B981", "#0EA5E9", "#C9A227", "#94A3B8", "#F59E0B"];

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div className="relative size-40">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="#C9A227"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-semibold text-white">{Math.round(pct)}</span>
        <span className="text-[10px] font-bold tracking-[0.18em] text-white/60 uppercase">out of 100</span>
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const [period, setPeriod] = useState<PerformancePeriod>("monthly");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [applied, setApplied] = useState<{ start: string; end: string } | null>(null);

  const params = useMemo(
    () => ({
      period,
      start: period === "custom" ? applied?.start : undefined,
      end: period === "custom" ? applied?.end : undefined,
    }),
    [period, applied],
  );
  const url = period === "custom" && !applied ? null : "/api/performance";
  const { data, loading, error, reload } = useFetch<Performance>(url, params);

  const statusData = useMemo(() => {
    if (!data) return [];
    const t = data.tasks;
    return [
      { name: "Completed", value: t.completed },
      { name: "In progress", value: t.in_progress },
      { name: "In review", value: t.in_review },
      { name: "To do", value: t.pending },
      { name: "On hold", value: t.on_hold },
    ].filter((d) => d.value > 0);
  }, [data]);

  const trendData = useMemo(
    () => (data?.trend ?? []).map((p) => ({ ...p, label: formatDate(p.date, "MMM d") })),
    [data],
  );

  const customInvalid = !start || !end || start > end;
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const exportParams = useMemo(
    () => ({
      period,
      start: period === "custom" ? applied?.start : undefined,
      end: period === "custom" ? applied?.end : undefined,
    }),
    [period, applied],
  );

  async function handleExport(kind: "pdf" | "excel") {
    if (period === "custom" && !applied) {
      toast.error("Apply a custom date range first");
      return;
    }
    setExporting(kind);
    try {
      await downloadExport(
        `/api/performance/export/${kind}`,
        exportParams,
        `performance-export.${kind === "pdf" ? "pdf" : "xlsx"}`,
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
        title="My Performance"
        description="Track your productivity, delivery and reporting consistency."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!data || exporting !== null}
              loading={exporting === "pdf"}
              onClick={() => void handleExport("pdf")}
            >
              <FileText />
              Export PDF
            </Button>
            <Button
              variant="gold"
              className="w-full sm:w-auto"
              disabled={!data || exporting !== null}
              loading={exporting === "excel"}
              onClick={() => void handleExport("excel")}
            >
              <FileSpreadsheet />
              Export Excel
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as PerformancePeriod)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {period === "custom" && (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full space-y-1.5 sm:w-auto">
              <Label htmlFor="p-start">Start date</Label>
              <Input id="p-start" type="date" className="w-full" value={start} max={end || todayISO()} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="w-full space-y-1.5 sm:w-auto">
              <Label htmlFor="p-end">End date</Label>
              <Input id="p-end" type="date" className="w-full" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <Button variant="gold" className="w-full sm:w-auto" disabled={customInvalid} onClick={() => setApplied({ start, end })}>
              Apply range
            </Button>
          </div>
        )}
      </div>

      {period === "custom" && !applied ? (
        <Card>
          <EmptyState icon={CalendarClock} title="Choose a custom date range" description="Pick a start and end date, then apply to see your metrics." />
        </Card>
      ) : loading && !data ? (
        <PageSkeleton />
      ) : error && !data ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : !data ? null : (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          <p className="text-[13px] font-medium text-ink-muted">
            Showing <span className="font-semibold text-navy">{formatDate(data.start_date)}</span> —{" "}
            <span className="font-semibold text-navy">{formatDate(data.end_date)}</span>
          </p>

          {/* Score + key metrics */}
          <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <Card className="relative overflow-hidden border-navy bg-gradient-to-br from-navy via-navy to-navy-sidebar text-white">
              <div className="bg-grid-faint pointer-events-none absolute inset-0 opacity-50" />
              <CardContent className="relative flex flex-col items-center gap-4 py-8">
                <p className="text-[11px] font-bold tracking-[0.2em] text-gold uppercase">Productivity score</p>
                <ScoreRing score={data.productivity_score} />
                <div className="flex items-center gap-2 rounded-full border border-gold/40 bg-white/10 px-4 py-1.5">
                  <Award className="size-4 text-gold" />
                  <span className="text-sm font-semibold">{data.rating}</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Tasks completed" value={`${data.tasks.completed}/${data.tasks.total}`} hint={`${data.tasks.completion_rate}% completion rate`} icon={CheckCircle2} tone="green" />
              <StatCard label="On-time delivery" value={`${data.tasks.on_time_rate}%`} hint={`${data.tasks.overdue} overdue now`} icon={Target} tone="gold" />
              <StatCard label="Milestones" value={`${data.milestones.completed}/${data.milestones.total}`} hint={`${data.milestones.completion_rate}% completion rate`} icon={CalendarClock} tone="navy" />
              <StatCard label="Hours logged" value={formatHours(data.reports.total_hours)} hint={`${formatHours(data.reports.average_hours_per_day)} avg per day`} icon={Clock} tone="blue" />
            </div>
          </section>

          {/* Detail cards */}
          <section className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="size-4 text-gold-dark" /> Task metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-ink-muted">
                    <span>Average progress</span>
                  </div>
                  <ProgressBar value={data.tasks.average_progress} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Total", data.tasks.total],
                    ["In progress", data.tasks.in_progress],
                    ["In review", data.tasks.in_review],
                    ["To do", data.tasks.pending],
                    ["On hold", data.tasks.on_hold],
                    ["Overdue", data.tasks.overdue],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-surface px-3 py-2">
                      <dt className="text-[11px] font-semibold text-ink-muted">{k}</dt>
                      <dd className="font-display text-lg font-semibold text-navy">{v}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-gold-dark" /> Milestone metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-ink-muted">
                    <span>Average progress</span>
                  </div>
                  <ProgressBar value={data.milestones.average_progress} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Total", data.milestones.total],
                    ["Completed", data.milestones.completed],
                    ["In progress", data.milestones.in_progress],
                    ["Overdue", data.milestones.overdue],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-surface px-3 py-2">
                      <dt className="text-[11px] font-semibold text-ink-muted">{k}</dt>
                      <dd className="font-display text-lg font-semibold text-navy">{v}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="size-4 text-gold-dark" /> Report consistency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-ink-muted">
                    <span>
                      {data.reports.submitted} of {data.reports.expected} working days
                    </span>
                  </div>
                  <ProgressBar value={data.reports.consistency_rate} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Submitted", data.reports.submitted],
                    ["Approved", data.reports.approved],
                    ["Revisions", data.reports.revision_requested],
                    ["Expected", data.reports.expected],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-surface px-3 py-2">
                      <dt className="text-[11px] font-semibold text-ink-muted">{k}</dt>
                      <dd className="font-display text-lg font-semibold text-navy">{v}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </section>

          {/* Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Activity trend</CardTitle>
              <CardDescription>Tasks completed and hours logged over time</CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length === 0 ? (
                <EmptyState compact icon={ClipboardCheck} title="No activity in this period" />
              ) : (
                <div className="h-56 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF5" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} minTickGap={24} />
                      <YAxis yAxisId="left" width={32} allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
                      <YAxis yAxisId="right" width={32} orientation="right" tickLine={false} axisLine={false} tick={AXIS} />
                      <Tooltip cursor={{ fill: "rgba(11,37,69,0.04)" }} contentStyle={TOOLTIP_STYLE} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Bar yAxisId="left" dataKey="tasks_completed" name="Tasks completed" fill="#0B2545" radius={[4, 4, 0, 0]} maxBarSize={26} />
                      <Line yAxisId="right" type="monotone" dataKey="hours_logged" name="Hours logged" stroke="#C9A227" strokeWidth={2.5} dot={{ r: 3, fill: "#C9A227", strokeWidth: 0 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakdowns */}
          <section className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Task status</CardTitle>
                <CardDescription>Distribution in this period</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <EmptyState compact icon={ListChecks} title="No tasks in this period" />
                ) : (
                  <div className="h-52 w-full sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                          {statusData.map((_, i) => (
                            <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tasks by priority</CardTitle>
                <CardDescription>How your workload is weighted</CardDescription>
              </CardHeader>
              <CardContent>
                {data.tasks_by_priority.every((b) => b.count === 0) ? (
                  <EmptyState compact icon={ListChecks} title="No tasks in this period" />
                ) : (
                  <div className="h-52 w-full sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.tasks_by_priority} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF5" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
                        <YAxis width={32} allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
                        <Tooltip cursor={{ fill: "rgba(11,37,69,0.04)" }} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]} maxBarSize={44}>
                          {data.tasks_by_priority.map((b) => (
                            <Cell key={b.key} fill={PRIORITY_COLORS[b.key] ?? "#0B2545"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hours by project</CardTitle>
                <CardDescription>Where your time went</CardDescription>
              </CardHeader>
              <CardContent>
                {data.work_by_project.length === 0 ? (
                  <EmptyState compact icon={Clock} title="No logged work in this period" />
                ) : (
                  <div className="h-52 w-full sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.work_by_project} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8EEF5" />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS} />
                        <YAxis type="category" dataKey="label" width={72} tickLine={false} axisLine={false} tick={AXIS} />
                        <Tooltip cursor={{ fill: "rgba(11,37,69,0.04)" }} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="hours" name="Hours" fill="#C9A227" radius={[0, 6, 6, 0]} maxBarSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
