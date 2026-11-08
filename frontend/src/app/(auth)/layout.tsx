import { BarChart3, ClipboardList, ShieldCheck, Target } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense } from "react";

const HIGHLIGHTS = [
  { icon: ClipboardList, title: "Tasks & projects", text: "Every assignment, deadline and milestone in one place." },
  { icon: Target, title: "Daily work reports", text: "Log your day in minutes and track reviewer feedback." },
  { icon: BarChart3, title: "Performance insight", text: "See your productivity trends across any period." },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="bg-auth-hero relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="bg-grid-faint pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <p className="font-display text-2xl font-semibold tracking-tight">Workstation</p>
            <p className="text-[11px] font-semibold tracking-[0.28em] text-gold uppercase">Employee Portal</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <div className="mb-6 h-px w-14 bg-gold" />
          <h2 className="font-display text-4xl leading-[1.15] font-medium tracking-tight xl:text-[44px]">
            Where focused work
            <br />
            meets <span className="text-gold italic">clear results.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
            Your tasks, milestones and daily reports — organised in one calm, secure workspace.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-gold">
                  <Icon className="size-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-sm text-white/60">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="size-4 text-gold/80" />
          Secured access for Workstation employees only.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <div className="leading-tight">
              <p className="font-display text-xl font-semibold text-navy">Workstation</p>
              <p className="text-[10px] font-semibold tracking-[0.26em] text-gold-dark uppercase">
                Employee Portal
              </p>
            </div>
          </div>
          <Suspense fallback={null}>{children}</Suspense>
          <p className="mt-10 text-center text-xs text-ink-muted">
            © Workstation. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="flex size-11 items-center justify-center rounded-xl border border-gold/50 bg-navy shadow-md">
      <span className="font-display text-xl font-semibold text-gold">W</span>
    </span>
  );
}
