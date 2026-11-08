"use client";

import {
  Bell,
  CalendarClock,
  CheckCheck,
  FileText,
  FolderKanban,
  Info,
  ListChecks,
  MessageSquareQuote,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/use-fetch";
import { api, getErrorMessage } from "@/lib/api";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { Notification, NotificationList } from "@/types";

const ICONS: Record<string, LucideIcon> = {
  task: ListChecks,
  milestone: CalendarClock,
  project: FolderKanban,
  report: FileText,
  feedback: MessageSquareQuote,
  system: Info,
};

/** Map backend links to employee-portal routes (admin links are not navigable here). */
function resolveLink(link: string | null): string | null {
  if (!link || link.startsWith("/admin")) return null;
  return link.startsWith("/") ? link : null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { refreshUnread, setUnreadCount } = useAuth();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [limit, setLimit] = useState(30);
  const [markingAll, setMarkingAll] = useState(false);

  const params = useMemo(
    () => ({ unread_only: tab === "unread" ? true : undefined, limit }),
    [tab, limit],
  );
  const { data, loading, error, reload, setData } = useFetch<NotificationList>("/api/notifications", params);

  async function markRead(n: Notification) {
    if (n.is_read) return;
    setData((d) =>
      d
        ? {
            ...d,
            unread_count: Math.max(0, d.unread_count - 1),
            items: d.items.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)),
          }
        : d,
    );
    try {
      await api.patch(`/api/notifications/${n.id}/read`);
      void refreshUnread();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not mark as read"));
      void reload();
    }
  }

  async function open(n: Notification) {
    await markRead(n);
    const target = resolveLink(n.link);
    if (target) router.push(target);
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await api.patch("/api/notifications/read-all");
      setUnreadCount(0);
      toast.success("All notifications marked as read");
      await reload();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not mark all as read"));
    } finally {
      setMarkingAll(false);
    }
  }

  const unread = data?.unread_count ?? 0;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `You have ${unread} unread ${unread === 1 ? "notification" : "notifications"}.` : "You're all caught up."}
        actions={
          <Button variant="outline" onClick={markAll} loading={markingAll} disabled={unread === 0}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v as "all" | "unread"); setLimit(30); }} className="mb-5">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread{unread > 0 ? ` (${unread})` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error && !data ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title={tab === "unread" ? "No unread notifications" : "No notifications yet"}
            description="Updates about your tasks, milestones and reports will show up here."
          />
        </Card>
      ) : (
        <Card className={cn("overflow-hidden transition-opacity", loading && "opacity-60")}>
          <ul className="divide-y divide-line">
            {data.items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const target = resolveLink(n.link);
              return (
                <li key={n.id}>
                  <div
                    role={target || !n.is_read ? "button" : undefined}
                    tabIndex={target || !n.is_read ? 0 : undefined}
                    onClick={() => void open(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void open(n);
                      }
                    }}
                    className={cn(
                      "flex items-start gap-4 px-5 py-4 transition-colors",
                      !n.is_read ? "bg-gold-soft/30" : "bg-white",
                      (target || !n.is_read) && "cursor-pointer hover:bg-accent/70",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full",
                        n.is_read ? "bg-muted text-ink-muted" : "bg-navy text-gold",
                      )}
                    >
                      <Icon className="size-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={cn("min-w-0 flex-1 truncate text-sm", n.is_read ? "font-medium text-ink" : "font-semibold text-navy")}>
                          {n.title}
                        </p>
                        <span className="shrink-0 text-xs text-ink-muted" title={formatDateTime(n.created_at)}>
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-muted">{n.message}</p>
                    </div>
                    {!n.is_read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-gold" aria-label="Unread" />}
                  </div>
                </li>
              );
            })}
          </ul>
          {data.items.length < data.total && (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => Math.min(100, l + 30))} disabled={limit >= 100}>
                Load more
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
