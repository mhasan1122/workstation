export type Role = "employee" | "admin";
export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "completed" | "on_hold";
export type MilestoneStatus = "pending" | "in_progress" | "in_review" | "completed";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";
export type ReportStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested";
export type WorkStatus = "not_started" | "in_progress" | "completed" | "blocked";
export type NotificationType = "task" | "milestone" | "project" | "report" | "feedback" | "system";

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  joining_date: string | null;
  profile_picture: string | null;
  profile_picture_url: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserBrief {
  id: number;
  full_name: string;
  profile_picture: string | null;
  role: Role;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface MessageResponse {
  message: string;
}

export interface ProjectRef {
  id: number;
  name: string;
}

export interface Attachment {
  id: number;
  user_id: number | null;
  filename: string;
  file_path: string;
  url: string | null;
  created_at: string;
}

export interface Comment {
  id: number;
  user_id: number | null;
  user: UserBrief | null;
  content: string;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  deadline: string | null;
  project_id: number | null;
  project: ProjectRef | null;
  assigned_to: number | null;
  created_by: number | null;
  submitted_for_review_at: string | null;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
}

export interface TaskDetail extends Task {
  comments: Comment[];
  attachments: Attachment[];
}

export interface Milestone {
  id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  priority: Priority;
  progress: number;
  status: MilestoneStatus;
  project_id: number | null;
  project: ProjectRef | null;
  assigned_to: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  is_personal: boolean;
  is_overdue: boolean;
}

export interface MilestoneDetail extends Milestone {
  comments: Comment[];
  attachments: Attachment[];
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  deadline: string | null;
  status: ProjectStatus;
  overall_progress: number;
  created_by: number | null;
  created_at: string;
}

export interface ProjectListItem extends Project {
  member_count: number;
  my_tasks_total: number;
  my_tasks_completed: number;
  my_progress: number;
}

export interface ProjectDetail extends Project {
  members: UserBrief[];
  my_tasks: Task[];
  my_milestones: Milestone[];
  my_tasks_total: number;
  my_tasks_completed: number;
  my_progress: number;
}

export interface ReportEntry {
  id: number;
  report_id: number;
  task_title: string;
  work_description: string;
  project_id: number | null;
  project_name: string | null;
  project_label?: string | null;
  project: { id: number; name: string } | null;
  related_task_id: number | null;
  related_task: { id: number; title: string } | null;
  time_spent_hours: number;
  work_status: WorkStatus;
  achievement: string | null;
  challenges: string | null;
  next_day_plan: string | null;
}

export interface ReportEntryInput {
  task_title: string;
  work_description: string;
  project_id: number | null;
  related_task_id: number | null;
  time_spent_hours: number;
  work_status: WorkStatus;
  achievement: string | null;
  challenges: string | null;
  next_day_plan: string | null;
}

export interface ReportAttachment {
  id: number;
  report_id: number;
  entry_id: number | null;
  filename: string;
  file_path: string;
  url: string | null;
}

export interface Report {
  id: number;
  employee_id: number;
  report_date: string;
  status: ReportStatus;
  admin_feedback: string | null;
  employee_response: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  entries: ReportEntry[];
  attachments: ReportAttachment[];
  total_hours: number;
  entry_count: number;
  is_editable: boolean;
}

export interface ReportList {
  items: Report[];
  total: number;
  limit: number;
  offset: number;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: NotificationType | string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  total: number;
  unread_count: number;
}

export interface Activity {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  description: string;
}

export interface DashboardStats {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  pending_tasks: number;
  in_review_tasks: number;
  on_hold_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  average_task_progress: number;
  total_projects: number;
  active_projects: number;
  total_milestones: number;
  completed_milestones: number;
  reports_this_month: number;
  pending_reports_today: boolean;
  hours_this_week: number;
}

export interface UpcomingDeadline {
  type: "task" | "milestone" | string;
  id: number;
  title: string;
  deadline: string;
  days_left: number;
  priority: Priority;
  progress: number;
  project_name: string | null;
}

export interface ProjectProgressItem {
  id: number;
  name: string;
  status: string;
  deadline: string | null;
  overall_progress: number;
  my_progress: number;
  my_tasks_total: number;
  my_tasks_completed: number;
}

export interface MonthlyProductivity {
  month: string;
  label: string;
  tasks_completed: number;
  tasks_assigned: number;
  reports_submitted: number;
  hours_logged: number;
}

export interface FeedbackItem {
  report_id: number;
  report_date: string;
  status: string;
  feedback: string;
}

export interface Dashboard {
  stats: DashboardStats;
  todays_tasks: Task[];
  upcoming_deadlines: UpcomingDeadline[];
  recent_activities: Activity[];
  project_progress: ProjectProgressItem[];
  monthly_productivity: MonthlyProductivity[];
  recent_reports: Report[];
  recent_feedback: FeedbackItem[];
  unread_notifications: number;
}

export type PerformancePeriod = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

export interface TaskMetrics {
  total: number;
  completed: number;
  in_progress: number;
  in_review: number;
  pending: number;
  on_hold: number;
  overdue: number;
  completion_rate: number;
  on_time_rate: number;
  average_progress: number;
}

export interface MilestoneMetrics {
  total: number;
  completed: number;
  in_progress: number;
  overdue: number;
  completion_rate: number;
  average_progress: number;
}

export interface ReportMetrics {
  expected: number;
  submitted: number;
  approved: number;
  revision_requested: number;
  consistency_rate: number;
  total_hours: number;
  average_hours_per_day: number;
}

export interface TrendPoint {
  date: string;
  tasks_completed: number;
  hours_logged: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
  hours: number;
}

export interface Performance {
  period: PerformancePeriod;
  start_date: string;
  end_date: string;
  productivity_score: number;
  rating: string;
  tasks: TaskMetrics;
  milestones: MilestoneMetrics;
  reports: ReportMetrics;
  trend: TrendPoint[];
  tasks_by_priority: BreakdownItem[];
  work_by_project: BreakdownItem[];
}
