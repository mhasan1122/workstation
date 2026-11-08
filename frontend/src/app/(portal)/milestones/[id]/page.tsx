"use client";

import { useParams } from "next/navigation";
import { WorkItemDetail } from "@/components/shared/work-item-detail";

export default function MilestoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <WorkItemDetail kind="milestone" id={id} />;
}
