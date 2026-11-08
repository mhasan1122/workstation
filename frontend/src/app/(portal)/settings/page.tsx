"use client";

import { ArrowRight, Bell, CalendarClock, FileText, KeyRound, ListChecks, MessageSquareQuote, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Prefs {
  tasks: boolean;
  milestones: boolean;
  reports: boolean;
  feedback: boolean;
  email: boolean;
  reminder: boolean;
}

const DEFAULTS: Prefs = {
  tasks: true,
  milestones: true,
  reports: true,
  feedback: true,
  email: false,
  reminder: true,
};

const ITEMS: { key: keyof Prefs; title: string; description: string; icon: typeof Bell }[] = [
  { key: "tasks", title: "Task updates", description: "Assignments, status changes and review outcomes.", icon: ListChecks },
  { key: "milestones", title: "Milestone updates", description: "New milestones and deadline changes.", icon: CalendarClock },
  { key: "reports", title: "Report status", description: "When a report is approved or under review.", icon: FileText },
  { key: "feedback", title: "Reviewer feedback", description: "Comments and revision requests on your work.", icon: MessageSquareQuote },
  { key: "reminder", title: "Daily report reminder", description: "A nudge if today's report hasn't been submitted.", icon: Bell },
  { key: "email", title: "Email digest", description: "A summary of activity sent to your work email.", icon: Bell },
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2",
        checked ? "border-navy bg-navy" : "border-input bg-[#E8EEF5]",
      )}
    >
      <span
        className={cn(
          "inline-block size-[18px] rounded-full shadow transition-transform",
          checked ? "translate-x-[22px] bg-gold" : "translate-x-[3px] bg-white",
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const storageKey = `ep_prefs_${user.id}`;
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [saved, setSaved] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefs(parsed);
        setSaved(parsed);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, [storageKey]);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
    setSaved(prefs);
    toast.success("Notification preferences saved");
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="Settings" description="Manage how you are notified and secure your account." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-gold-dark" /> Notification preferences
          </CardTitle>
          <CardDescription>Preferences are stored on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul>
            {ITEMS.map((item, i) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-4 py-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                      <Icon className="size-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy">{item.title}</p>
                      <p className="text-[13px] text-ink-muted">{item.description}</p>
                    </div>
                    <Switch checked={prefs[item.key]} onChange={(v) => setPrefs((p) => ({ ...p, [item.key]: v }))} label={item.title} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setPrefs(DEFAULTS)} disabled={JSON.stringify(prefs) === JSON.stringify(DEFAULTS)}>
              <RotateCcw /> Reset to defaults
            </Button>
            <Button variant="gold" onClick={save} disabled={!dirty}>
              <Save /> Save preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-dark">
              <KeyRound className="size-[18px]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy">Password</p>
              <p className="text-[13px] text-ink-muted">Change your password to keep your account secure.</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/profile#password">
              Change password <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
