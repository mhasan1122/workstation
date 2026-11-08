"use client";

import { LogOut, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { pictureUrl } from "@/lib/api";
import { cn, initials } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, unreadCount, logout } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-navy-deep/60 backdrop-blur-[2px] transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-navy-sidebar text-white transition-transform duration-300 ease-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <span className="flex size-10 items-center justify-center rounded-xl border border-gold/50 bg-navy shadow-md">
              <span className="font-display text-lg font-semibold text-gold">W</span>
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[19px] font-semibold tracking-tight">Workstation</span>
              <span className="block text-[10px] font-semibold tracking-[0.26em] text-gold uppercase">
                Employee Portal
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="scroll-thin flex-1 space-y-7 overflow-y-auto px-3 py-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2.5 px-3 text-[10.5px] font-bold tracking-[0.18em] text-white/40 uppercase">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = item.match ? item.match(pathname) : pathname === item.href;
                  const Icon = item.icon;
                  const badge = item.badge === "notifications" ? unreadCount : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors",
                          active
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        {active && (
                          <span className="absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gold" />
                        )}
                        <Icon
                          className={cn(
                            "size-[18px] shrink-0 transition-colors",
                            active ? "text-gold" : "text-white/50 group-hover:text-white/80",
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-navy">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2.5">
            <Avatar className="size-9 border border-gold/40">
              <AvatarImage src={pictureUrl(user.profile_picture_url ?? user.profile_picture)} alt="" />
              <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold">{user.full_name}</p>
              <p className="truncate text-[11px] text-white/50">{user.designation ?? user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-gold"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
