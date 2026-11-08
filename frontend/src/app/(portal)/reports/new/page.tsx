"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, PageSkeleton } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReportForm } from "@/components/reports/report-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFetch } from "@/hooks/use-fetch";
import { formatHours } from "@/lib/utils";
import type { Report } from "@/types";

export default function NewReportPage() {
  const router = useRouter();
  const { data: today, loading, error, reload } = useFetch<Report | null>("/api/reports/today");
  const [forceNew, setForceNew] = useState(false);

  // An editable report for today already exists → continue it instead of duplicating.
  useEffect(() => {
    if (today && today.is_editable) router.replace(`/reports/${today.id}/edit`);
  }, [today, router]);

  if (loading) return <PageSkeleton />;
  if (error)
    return (
      <Card>
        <ErrorState message={error} onRetry={reload} />
      </Card>
    );
  if (today && today.is_editable) return <PageSkeleton />;

  if (today && !forceNew) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Submit Daily Report" description="Log the work you completed today." />
        <Card className="mx-auto max-w-xl p-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-7" />
          </div>
          <h2 className="font-display text-xl font-semibold text-navy">Today&apos;s report is already in</h2>
          <div className="mt-2 flex items-center justify-center gap-2">
            <StatusBadge kind="report" value={today.status} />
            <span className="text-sm text-ink-muted">
              {today.entry_count} {today.entry_count === 1 ? "entry" : "entries"} · {formatHours(today.total_hours)}
            </span>
          </div>
          <p className="mx-auto mt-3 max-w-sm text-sm text-ink-muted">
            You can only submit one report per day. You can still log a report for a previous date.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild variant="gold">
              <Link href={`/reports/${today.id}`}>View today&apos;s report</Link>
            </Button>
            <Button variant="outline" onClick={() => setForceNew(true)}>
              Report for another date
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Submit Daily Report"
        description="Record what you worked on, time spent, achievements and challenges."
      />
      <ReportForm />
    </div>
  );
}
