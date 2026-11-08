"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/shared/states";
import { ReportForm } from "@/components/reports/report-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFetch } from "@/hooks/use-fetch";
import { formatDate } from "@/lib/utils";
import type { Report } from "@/types";

export default function EditReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useFetch<Report>(`/api/reports/${id}`);

  if (loading && !data) return <PageSkeleton />;
  if (error && !data)
    return (
      <Card>
        <ErrorState message={error} onRetry={reload} />
      </Card>
    );
  if (!data) return null;

  if (!data.is_editable) {
    return (
      <div className="animate-fade-up">
        <PageHeader backHref={`/reports/${data.id}`} backLabel="Back to report" title="Edit Daily Report" />
        <Card>
          <EmptyState
            icon={Lock}
            title="This report can no longer be edited"
            description="Only draft reports and reports with a revision request can be changed."
            action={
              <Button asChild variant="gold">
                <Link href={`/reports/${data.id}`}>View report</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        backHref={`/reports/${data.id}`}
        backLabel="Back to report"
        title={data.status === "revision_requested" ? "Revise Daily Report" : "Edit Daily Report"}
        description={`Report for ${formatDate(data.report_date, "EEEE, MMMM d, yyyy")}`}
      />
      <ReportForm report={data} />
    </div>
  );
}
