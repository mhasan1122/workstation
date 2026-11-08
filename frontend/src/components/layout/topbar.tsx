"use client";

import { Bell, ChevronDown, LogOut, Menu, Settings, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pictureUrl } from "@/lib/api";
import { initials } from "@/lib/utils";
import { titleForPath } from "./nav";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, unreadCount, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 rounded-lg p-2 text-navy hover:bg-accent lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-xl font-semibold tracking-tight text-navy sm:text-[22px]">
          {titleForPath(pathname)}
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      <Link
        href="/notifications"
        className="relative shrink-0 rounded-full border border-line bg-white p-2.5 text-navy transition-colors hover:border-gold/60 hover:bg-gold-soft/50"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-full border border-line bg-white py-1 pr-2.5 pl-1 transition-colors hover:border-gold/60 focus-visible:ring-2 focus-visible:ring-gold"
          >
            <Avatar className="size-8">
              <AvatarImage src={pictureUrl(user.profile_picture_url ?? user.profile_picture)} alt="" />
              <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[140px] truncate text-[13px] font-semibold text-navy">
                {user.full_name}
              </span>
              <span className="block max-w-[140px] truncate text-[11px] text-ink-muted">
                {user.designation ?? user.email}
              </span>
            </span>
            <ChevronDown className="hidden size-4 text-ink-muted sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-semibold text-navy">{user.full_name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/profile")}>
            <UserCircle /> My Profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/notifications")}>
            <Bell /> Notifications
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/settings")}>
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
