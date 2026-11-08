from enum import StrEnum


class UserRole(StrEnum):
    EMPLOYEE = "employee"
    ADMIN = "admin"


class ProjectStatus(StrEnum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"


class MilestoneStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"


class ReportStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REVISION_REQUESTED = "revision_requested"


class WorkStatus(StrEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


class NotificationType(StrEnum):
    TASK = "task"
    MILESTONE = "milestone"
    PROJECT = "project"
    REPORT = "report"
    FEEDBACK = "feedback"
    SYSTEM = "system"
