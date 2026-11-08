import {
  Bell,
  CalendarClock,
  FilePlus2,
  FolderKanban,
  History,
  LayoutDashboard,
  ListChecks,
  Settings,
  TrendingUp,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** custom active matcher */
  match?: (pathname: string) => boolean;
  badge?: "notifications";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const startsWith = (base: string) => (p: string) => p === base || p.startsWith(`${base}/`);

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, match: startsWith("/dashboard") },
      { label: "My Tasks", href: "/tasks", icon: ListChecks, match: startsWith("/tasks") },
      { label: "My Projects", href: "/projects", icon: FolderKanban, match: startsWith("/projects") },
      { label: "My Milestones", href: "/milestones", icon: CalendarClock, match: startsWith("/milestones") },
    ],
  },
  {
    title: "Work Reports",
    items: [
      {
        label: "Submit Daily Report",
        href: "/reports/new",
        icon: FilePlus2,
        match: (p) => p === "/reports/new" || /^\/reports\/\d+\/edit/.test(p),
      },
      {
        label: "Report History",
        href: "/reports",
        icon: History,
        match: (p) => (p === "/reports" || p.startsWith("/reports/")) && p !== "/reports/new" && !/\/edit/.test(p),
      },
      { label: "My Performance", href: "/performance", icon: TrendingUp, match: startsWith("/performance") },
    ],
  },
  {
    title: "Other",
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell, match: startsWith("/notifications"), badge: "notifications" },
      { label: "My Profile", href: "/profile", icon: UserCircle, match: startsWith("/profile") },
      { label: "Settings", href: "/settings", icon: Settings, match: startsWith("/settings") },
    ],
  },
];

const TITLES: [RegExp, string][] = [
  [/^\/dashboard/, "Dashboard"],
  [/^\/tasks\/[^/]+/, "Task Details"],
  [/^\/tasks/, "My Tasks"],
  [/^\/projects\/[^/]+/, "Project Details"],
  [/^\/projects/, "My Projects"],
  [/^\/milestones\/[^/]+/, "Milestone Details"],
  [/^\/milestones/, "My Milestones"],
  [/^\/reports\/new/, "Submit Daily Report"],
  [/^\/reports\/[^/]+\/edit/, "Edit Daily Report"],
  [/^\/reports\/[^/]+/, "Report Details"],
  [/^\/reports/, "Report History"],
  [/^\/performance/, "My Performance"],
  [/^\/notifications/, "Notifications"],
  [/^\/profile/, "My Profile"],
  [/^\/settings/, "Settings"],
];

export function titleForPath(pathname: string): string {
  return TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Employee Portal";
}
