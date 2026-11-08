"use client";

import {
  Activity as ActivityIcon,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  FolderKanban,
  ListChecks,
  MessageSquareQuote,
  PlayCircle,
  Timer,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/progress-bits";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/shared/states";
import { PriorityDot, StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import { daysLeftLabel, formatDate, formatHours, timeAgo } from "@/lib/utils";
import type { Dashboard, NotificationList } from "@/types";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ViewAll({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy hover:text-gold-dark"
    >
      {label}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch<Dashboard>("/api/dashboard");
  const notifs = useFetch<NotificationList>("/api/notifications", { limit: 5 });

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { stats } = data;

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title={`${greeting()}, ${user.full_name.split(" ")[0]}`}
        description={`${formatDate(new Date(), "EEEE, MMMM d, yyyy")} · ${user.designation ?? "Employee"}${user.department ? `, ${user.department}` : ""}`}
          actions={
          <Button asChild variant="gold" className="w-full sm:w-auto">
            <Link href="/reports/new">
              <FileText />
              Submit daily report
            </Link>
          </Button>
        }
      />

      {stats.pending_reports_today && (
        <div className="flex flex-col gap-3 rounded-xl border border-gold/40 bg-gold-soft/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-gold-dark" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy">Today&apos;s daily report is pending</p>
              <p className="text-[13px] text-ink-muted">
                Log what you worked on today so your reviewers stay up to date.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href="/reports/new">Write report</Link>
          </Button>
        </div>
      )}

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tasks" value={stats.total_tasks} hint={`${stats.pending_tasks} to do · ${stats.on_hold_tasks} on hold`} icon={ListChecks} tone="navy" />
        <StatCard label="In progress" value={stats.in_progress_tasks} hint={`${stats.in_review_tasks} awaiting review`} icon={PlayCircle} tone="blue" />
        <StatCard label="Completed" value={stats.completed_tasks} hint={`${stats.completion_rate}% completion rate`} icon={CheckCircle2} tone="green" />
        <StatCard label="Overdue" value={stats.overdue_tasks} hint={stats.overdue_tasks ? "Needs your attention" : "You're all caught up"} icon={TriangleAlert} tone={stats.overdue_tasks ? "red" : "green"} />
        <StatCard label="Active projects" value={stats.active_projects} hint={`${stats.total_projects} projects in total`} icon={FolderKanban} tone="gold" />
        <StatCard label="Milestones" value={`${stats.completed_milestones}/${stats.total_milestones}`} hint="Completed milestones" icon={CalendarClock} tone="navy" />
        <StatCard label="Reports this month" value={stats.reports_this_month} hint="Daily reports submitted" icon={FileText} tone="blue" />
        <StatCard label="Hours this week" value={formatHours(stats.hours_this_week)} hint={`Avg task progress ${Math.round(stats.average_task_progress)}%`} icon={Timer} tone="gold" />
      </section>

      {/* Today's tasks + Upcoming deadlines */}
      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Today&apos;s tasks</CardTitle>
              <CardDescription>Work that needs your focus right now</CardDescription>
            </div>
            <CardAction>
              <ViewAll href="/tasks" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.todays_tasks.length === 0 ? (
              <EmptyState compact icon={ListChecks} title="Nothing scheduled today" description="No tasks need attention today." />
            ) : (
              <ul className="divide-y divide-line">
                {data.todays_tasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tasks/${t.id}`}
                      className="-mx-2 flex flex-col gap-3 rounded-lg px-2 py-3.5 transition-colors hover:bg-accent/70 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <PriorityDot priority={t.priority} />
                          <p className="truncate text-sm font-semibold text-navy">{t.title}</p>
                        </div>
                        <p className="mt-0.5 truncate pl-4 text-xs text-ink-muted">
                          {t.project?.name ?? "Personal task"} · Due {formatDate(t.deadline)}
                        </p>
                      </div>
                      <div className="flex w-full min-w-0 items-center gap-3 pl-4 sm:w-auto sm:pl-0">
                        <ProgressBar value={t.progress} overdue={t.is_overdue} className="min-w-0 flex-1 sm:w-32 sm:flex-none" />
                        <StatusBadge kind="task" value={t.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
            <CardDescription>Tasks and milestones due soon</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcoming_deadlines.length === 0 ? (
              <EmptyState compact icon={Clock} title="No upcoming deadlines" />
            ) : (
              <ul className="space-y-3">
                {data.upcoming_deadlines.map((d) => (
                  <li key={`${d.type}-${d.id}`}>
                    <Link
                      href={d.type === "milestone" ? `/milestones/${d.id}` : `/tasks/${d.id}`}
                      className="flex items-start gap-3 rounded-lg border border-line p-3 transition-colors hover:border-gold/50 hover:bg-gold-soft/30"
                    >
                      <div
                        className={`flex size-10 shrink-0 flex-col items-center justify-center rounded-lg text-center leading-none ${
                          d.days_left < 0
                            ? "bg-red-50 text-red-600"
                            : d.days_left <= 2
                              ? "bg-amber-50 text-amber-700"
                              : "bg-navy/5 text-navy"
                        }`}
                      >
                        <span className="text-[15px] font-bold">{formatDate(d.deadline, "d")}</span>
                        <span className="mt-0.5 text-[9px] font-bold tracking-wider uppercase">
                          {formatDate(d.deadline, "MMM")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy">{d.title}</p>
                        <p className="truncate text-xs text-ink-muted">
                          {d.type === "milestone" ? "Milestone" : "Task"}
                          {d.project_name ? ` · ${d.project_name}` : ""}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-semibold ${d.days_left < 0 ? "text-red-600" : d.days_left <= 2 ? "text-amber-700" : "text-ink-muted"}`}
                          >
                            {daysLeftLabel(d.days_left)}
                          </span>
                          <StatusBadge kind="priority" value={d.priority} />
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Productivity + project progress */}
      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Monthly productivity</CardTitle>
            <CardDescription>Tasks completed vs. assigned, with hours logged</CardDescription>
          </CardHeader>
          <CardContent>
            {data.monthly_productivity.length === 0 ? (
              <EmptyState compact icon={ActivityIcon} title="No productivity data yet" />
            ) : (
              <div className="h-56 w-full min-w-0 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.monthly_productivity} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF5" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#5B6B82", fontSize: 11 }} minTickGap={16} />
                    <YAxis yAxisId="left" width={28} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#5B6B82", fontSize: 11 }} />
                    <YAxis yAxisId="right" width={28} orientation="right" tickLine={false} axisLine={false} tick={{ fill: "#5B6B82", fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(11,37,69,0.04)" }}
                      contentStyle={{ borderRadius: 10, border: "1px solid #E8EEF5", boxShadow: "0 10px 30px -8px rgba(11,37,69,0.18)", fontSize: 12 }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar yAxisId="left" dataKey="tasks_assigned" name="Assigned" fill="#CBD6E6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar yAxisId="left" dataKey="tasks_completed" name="Completed" fill="#0B2545" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line yAxisId="right" type="monotone" dataKey="hours_logged" name="Hours logged" stroke="#C9A227" strokeWidth={2.5} dot={{ r: 3, fill: "#C9A227", strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Project progress</CardTitle>
              <CardDescription>Your contribution vs. overall</CardDescription>
            </div>
            <CardAction>
              <ViewAll href="/projects" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.project_progress.length === 0 ? (
              <EmptyState compact icon={FolderKanban} title="No projects yet" />
            ) : (
              <ul className="space-y-5">
                {data.project_progress.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="group block">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-navy group-hover:text-gold-dark">{p.name}</p>
                        <StatusBadge kind="project" value={p.status} hideIcon />
                      </div>
                      <ProgressBar value={p.overall_progress} />
                      <p className="mt-1.5 text-xs text-ink-muted">
                        My tasks {p.my_tasks_completed}/{p.my_tasks_total} · My progress {p.my_progress}%
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Reports / feedback / activity / notifications */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Recent reports</CardTitle>
              <CardDescription>Your latest daily work reports</CardDescription>
            </div>
            <CardAction>
              <ViewAll href="/reports" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.recent_reports.length === 0 ? (
              <EmptyState
                compact
                icon={FileText}
                title="No reports yet"
                action={
                  <Button asChild size="sm" variant="gold">
                    <Link href="/reports/new">Create your first report</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.recent_reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/reports/${r.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent/70">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                        <FileText className="size-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy">{formatDate(r.report_date, "EEE, MMM d, yyyy")}</p>
                        <p className="text-xs text-ink-muted">
                          {r.entry_count} {r.entry_count === 1 ? "entry" : "entries"} · {formatHours(r.total_hours)}
                        </p>
                      </div>
                      <StatusBadge kind="report" value={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admin feedback</CardTitle>
            <CardDescription>Latest comments on your reports</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recent_feedback.length === 0 ? (
              <EmptyState compact icon={MessageSquareQuote} title="No feedback yet" description="Reviewer feedback will appear here." />
            ) : (
              <ul className="space-y-3">
                {data.recent_feedback.map((f) => (
                  <li key={f.report_id}>
                    <Link href={`/reports/${f.report_id}`} className="block rounded-lg border border-line border-l-[3px] border-l-gold bg-surface p-3.5 transition-colors hover:bg-gold-soft/30">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-navy">Report · {formatDate(f.report_date)}</span>
                        <StatusBadge kind="report" value={f.status} hideIcon />
                      </div>
                      <p className="line-clamp-3 text-sm text-ink">&ldquo;{f.feedback}&rdquo;</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>What you&apos;ve been up to</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recent_activities.length === 0 ? (
              <EmptyState compact icon={ActivityIcon} title="No recent activity" />
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {data.recent_activities.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-white bg-gold ring-1 ring-gold/40" />
                    <p className="text-sm text-ink">{a.description}</p>
                    <p className="text-xs text-ink-muted">{timeAgo(a.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                Notifications
                {data.unread_notifications > 0 && <Badge variant="gold">{data.unread_notifications} new</Badge>}
              </CardTitle>
              <CardDescription>Latest updates for you</CardDescription>
            </div>
            <CardAction>
              <ViewAll href="/notifications" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {notifs.loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : notifs.error ? (
              <ErrorState message={notifs.error} onRetry={notifs.reload} className="py-6" />
            ) : !notifs.data || notifs.data.items.length === 0 ? (
              <EmptyState compact icon={Bell} title="You're all caught up" />
            ) : (
              <ul className="divide-y divide-line">
                {notifs.data.items.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 py-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.is_read ? "bg-slate-300" : "bg-gold"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${n.is_read ? "text-ink" : "font-semibold text-navy"}`}>{n.title}</p>
                      <p className="line-clamp-1 text-xs text-ink-muted">{n.message}</p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted">{timeAgo(n.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
