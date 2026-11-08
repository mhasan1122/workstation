"""PDF and Excel export builders (metrics + charts)."""

from __future__ import annotations

import io
from datetime import date
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas.performance import PerformanceResponse

NAVY = "#0B2545"
GOLD = "#C9A227"
MUTED = "#5B6B82"


def _fig_to_png(fig: plt.Figure) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def _style_axes(ax: Any) -> None:
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.tick_params(colors=MUTED, labelsize=8)
    ax.yaxis.label.set_color(MUTED)
    ax.xaxis.label.set_color(MUTED)


def build_performance_chart_images(data: PerformanceResponse) -> dict[str, bytes]:
    images: dict[str, bytes] = {}

    # Trend: tasks completed + hours
    if data.trend:
        fig, ax1 = plt.subplots(figsize=(7.2, 3.2))
        xs = [p.date.isoformat() for p in data.trend]
        tasks = [p.tasks_completed for p in data.trend]
        hours = [p.hours_logged for p in data.trend]
        ax1.bar(xs, tasks, color=NAVY, alpha=0.85, label="Tasks completed")
        ax2 = ax1.twinx()
        ax2.plot(xs, hours, color=GOLD, marker="o", linewidth=2, label="Hours logged")
        ax1.set_title("Productivity trend", color=NAVY, fontsize=11, pad=10)
        ax1.set_ylabel("Tasks")
        ax2.set_ylabel("Hours")
        if len(xs) > 8:
            step = max(1, len(xs) // 8)
            ax1.set_xticks(range(0, len(xs), step))
            ax1.set_xticklabels([xs[i][5:] for i in range(0, len(xs), step)], rotation=30, ha="right")
        else:
            ax1.set_xticklabels([x[5:] for x in xs], rotation=30, ha="right")
        _style_axes(ax1)
        _style_axes(ax2)
        lines1, labels1 = ax1.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left", fontsize=8)
        fig.tight_layout()
        images["trend"] = _fig_to_png(fig)

    # Task status pie
    status_vals = [
        ("Completed", data.tasks.completed),
        ("In progress", data.tasks.in_progress),
        ("In review", data.tasks.in_review),
        ("To do", data.tasks.pending),
        ("On hold", data.tasks.on_hold),
    ]
    status_vals = [(n, v) for n, v in status_vals if v > 0]
    if status_vals:
        fig, ax = plt.subplots(figsize=(4.8, 3.6))
        ax.pie(
            [v for _, v in status_vals],
            labels=[n for n, _ in status_vals],
            autopct="%1.0f%%",
            colors=["#10B981", "#0EA5E9", GOLD, "#94A3B8", "#F59E0B"][: len(status_vals)],
            startangle=90,
            textprops={"fontsize": 8, "color": NAVY},
        )
        ax.set_title("Tasks by status", color=NAVY, fontsize=11)
        fig.tight_layout()
        images["status"] = _fig_to_png(fig)

    # Priority bars
    if data.tasks_by_priority:
        fig, ax = plt.subplots(figsize=(5.2, 3.2))
        labels = [i.label for i in data.tasks_by_priority]
        counts = [i.count for i in data.tasks_by_priority]
        ax.barh(labels, counts, color=["#DC2626", "#F59E0B", "#0EA5E9", "#94A3B8"][: len(labels)])
        ax.set_title("Tasks by priority", color=NAVY, fontsize=11)
        ax.set_xlabel("Count")
        _style_axes(ax)
        fig.tight_layout()
        images["priority"] = _fig_to_png(fig)

    # Project contribution
    if data.work_by_project:
        fig, ax = plt.subplots(figsize=(6.2, 3.4))
        labels = [i.label[:22] for i in data.work_by_project]
        hours = [i.hours for i in data.work_by_project]
        ax.bar(labels, hours, color=NAVY)
        ax.set_title("Hours by project", color=NAVY, fontsize=11)
        ax.set_ylabel("Hours")
        ax.tick_params(axis="x", rotation=25, labelsize=8)
        _style_axes(ax)
        fig.tight_layout()
        images["projects"] = _fig_to_png(fig)

    return images


def build_performance_pdf(
    data: PerformanceResponse,
    *,
    employee_name: str,
    email: str,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        title=f"Performance Report — {employee_name}",
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleNavy",
        parent=styles["Heading1"],
        textColor=colors.HexColor(NAVY),
        fontSize=18,
        spaceAfter=6,
        alignment=TA_LEFT,
    )
    subtitle = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        textColor=colors.HexColor(MUTED),
        fontSize=10,
        spaceAfter=12,
    )
    h2 = ParagraphStyle(
        "H2Navy",
        parent=styles["Heading2"],
        textColor=colors.HexColor(NAVY),
        fontSize=12,
        spaceBefore=10,
        spaceAfter=6,
    )
    body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#0F172A"))

    story: list[Any] = []
    story.append(Paragraph("Workstation · Employee Performance Report", title))
    story.append(
        Paragraph(
            f"{employee_name} · {email}<br/>"
            f"Period: <b>{data.period.value.title()}</b> · "
            f"{data.start_date.isoformat()} to {data.end_date.isoformat()} · "
            f"Generated {date.today().isoformat()}",
            subtitle,
        )
    )

    summary = [
        ["Productivity score", f"{data.productivity_score:.0f} / 100", "Rating", data.rating],
        [
            "Tasks completed",
            f"{data.tasks.completed}/{data.tasks.total}",
            "Completion rate",
            f"{data.tasks.completion_rate:.1f}%",
        ],
        [
            "On-time rate",
            f"{data.tasks.on_time_rate:.1f}%",
            "Overdue tasks",
            str(data.tasks.overdue),
        ],
        [
            "Milestones done",
            f"{data.milestones.completed}/{data.milestones.total}",
            "Milestone rate",
            f"{data.milestones.completion_rate:.1f}%",
        ],
        [
            "Reports submitted",
            f"{data.reports.submitted}/{data.reports.expected}",
            "Consistency",
            f"{data.reports.consistency_rate:.1f}%",
        ],
        [
            "Hours logged",
            f"{data.reports.total_hours:.1f}h",
            "Avg hours / day",
            f"{data.reports.average_hours_per_day:.1f}h",
        ],
    ]
    table = Table(summary, colWidths=[1.5 * inch, 1.4 * inch, 1.5 * inch, 1.6 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F6F8FB")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F6F8FB")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor(NAVY)),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E8EEF5")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 0.18 * inch))

    images = build_performance_chart_images(data)
    if "trend" in images:
        story.append(Paragraph("Productivity trend", h2))
        story.append(Image(io.BytesIO(images["trend"]), width=6.6 * inch, height=2.9 * inch))

    row_imgs: list[Any] = []
    if "status" in images:
        row_imgs.append(Image(io.BytesIO(images["status"]), width=3.1 * inch, height=2.35 * inch))
    if "priority" in images:
        row_imgs.append(Image(io.BytesIO(images["priority"]), width=3.3 * inch, height=2.2 * inch))
    if row_imgs:
        story.append(Paragraph("Task distribution", h2))
        if len(row_imgs) == 2:
            pair = Table([[row_imgs[0], row_imgs[1]]], colWidths=[3.3 * inch, 3.3 * inch])
            pair.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
            story.append(pair)
        else:
            story.append(row_imgs[0])

    if "projects" in images:
        story.append(Paragraph("Project contribution (hours)", h2))
        story.append(Image(io.BytesIO(images["projects"]), width=6.4 * inch, height=3.0 * inch))

    # Detail tables
    story.append(Paragraph("Tasks by priority", h2))
    pri_rows = [["Priority", "Count", "Hours"]] + [
        [i.label, str(i.count), f"{i.hours:.1f}"] for i in data.tasks_by_priority
    ] or [["—", "0", "0.0"]]
    pri = Table(pri_rows, colWidths=[2.4 * inch, 1.5 * inch, 1.5 * inch])
    pri.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(NAVY)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E8EEF5")),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    story.append(pri)

    story.append(Paragraph("Work by project", h2))
    proj_rows = [["Project", "Tasks / entries", "Hours"]] + [
        [i.label, str(i.count), f"{i.hours:.1f}"] for i in data.work_by_project
    ] or [["—", "0", "0.0"]]
    proj = Table(proj_rows, colWidths=[3.2 * inch, 1.5 * inch, 1.2 * inch])
    proj.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(NAVY)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E8EEF5")),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    story.append(proj)

    if data.trend:
        story.append(Paragraph("Daily trend data", h2))
        trend_rows = [["Date", "Tasks completed", "Hours logged"]] + [
            [p.date.isoformat(), str(p.tasks_completed), f"{p.hours_logged:.1f}"] for p in data.trend
        ]
        trend = Table(trend_rows, colWidths=[2.0 * inch, 2.0 * inch, 2.0 * inch])
        trend.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(GOLD)),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor(NAVY)),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E8EEF5")),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F6F8FB")]),
                ]
            )
        )
        story.append(trend)

    story.append(Spacer(1, 0.25 * inch))
    story.append(
        Paragraph(
            "Confidential — for internal use only. Generated by Workstation Employee Portal.",
            ParagraphStyle("Foot", parent=body, fontSize=8, textColor=colors.HexColor(MUTED), alignment=TA_CENTER),
        )
    )

    doc.build(story)
    return buffer.getvalue()


def build_performance_excel(
    data: PerformanceResponse,
    *,
    employee_name: str,
    email: str,
) -> bytes:
    wb = Workbook()
    header_fill = PatternFill("solid", fgColor="0B2545")
    header_font = Font(color="FFFFFF", bold=True)
    gold_fill = PatternFill("solid", fgColor="C9A227")
    thin = Border(
        left=Side(style="thin", color="E8EEF5"),
        right=Side(style="thin", color="E8EEF5"),
        top=Side(style="thin", color="E8EEF5"),
        bottom=Side(style="thin", color="E8EEF5"),
    )

    def style_header(ws: Any, row: int = 1) -> None:
        for cell in ws[row]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin

    def autosize(ws: Any) -> None:
        for col in ws.columns:
            width = max(len(str(c.value or "")) for c in col) + 2
            ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(width, 12), 42)

    # Summary
    ws = wb.active
    ws.title = "Summary"
    ws.append(["Workstation Employee Performance Export"])
    ws["A1"].font = Font(bold=True, size=14, color="0B2545")
    ws.append(["Employee", employee_name])
    ws.append(["Email", email])
    ws.append(["Period", data.period.value.title()])
    ws.append(["Start date", data.start_date.isoformat()])
    ws.append(["End date", data.end_date.isoformat()])
    ws.append(["Generated", date.today().isoformat()])
    ws.append([])
    ws.append(["Metric", "Value"])
    style_header(ws, 10)
    metrics = [
        ("Productivity score", data.productivity_score),
        ("Rating", data.rating),
        ("Tasks total", data.tasks.total),
        ("Tasks completed", data.tasks.completed),
        ("Tasks in progress", data.tasks.in_progress),
        ("Tasks in review", data.tasks.in_review),
        ("Tasks to do", data.tasks.pending),
        ("Tasks on hold", data.tasks.on_hold),
        ("Tasks overdue", data.tasks.overdue),
        ("Task completion rate %", data.tasks.completion_rate),
        ("On-time rate %", data.tasks.on_time_rate),
        ("Average task progress %", data.tasks.average_progress),
        ("Milestones total", data.milestones.total),
        ("Milestones completed", data.milestones.completed),
        ("Milestone completion rate %", data.milestones.completion_rate),
        ("Reports expected", data.reports.expected),
        ("Reports submitted", data.reports.submitted),
        ("Reports approved", data.reports.approved),
        ("Revision requested", data.reports.revision_requested),
        ("Report consistency %", data.reports.consistency_rate),
        ("Total hours", data.reports.total_hours),
        ("Avg hours / day", data.reports.average_hours_per_day),
    ]
    for k, v in metrics:
        ws.append([k, v])
    autosize(ws)

    # Trend + line/bar chart
    trend_ws = wb.create_sheet("Trend")
    trend_ws.append(["Date", "Tasks completed", "Hours logged"])
    style_header(trend_ws)
    for p in data.trend:
        trend_ws.append([p.date.isoformat(), p.tasks_completed, p.hours_logged])
    if data.trend:
        bar = BarChart()
        bar.type = "col"
        bar.title = "Tasks completed"
        bar.y_axis.title = "Tasks"
        data_ref = Reference(trend_ws, min_col=2, min_row=1, max_row=len(data.trend) + 1)
        cats = Reference(trend_ws, min_col=1, min_row=2, max_row=len(data.trend) + 1)
        bar.add_data(data_ref, titles_from_data=True)
        bar.set_categories(cats)
        bar.shape = 4
        bar.width = 18
        bar.height = 8
        trend_ws.add_chart(bar, "E2")

        line = LineChart()
        line.title = "Hours logged"
        line.y_axis.title = "Hours"
        line_data = Reference(trend_ws, min_col=3, min_row=1, max_row=len(data.trend) + 1)
        line.add_data(line_data, titles_from_data=True)
        line.set_categories(cats)
        line.width = 18
        line.height = 8
        line.style = 10
        trend_ws.add_chart(line, "E18")
    autosize(trend_ws)

    # Priority + pie
    pri_ws = wb.create_sheet("Priority")
    pri_ws.append(["Priority", "Count", "Hours"])
    style_header(pri_ws)
    for i in data.tasks_by_priority:
        pri_ws.append([i.label, i.count, i.hours])
    if data.tasks_by_priority:
        pie = PieChart()
        pie.title = "Tasks by priority"
        labels = Reference(pri_ws, min_col=1, min_row=2, max_row=len(data.tasks_by_priority) + 1)
        pie_data = Reference(pri_ws, min_col=2, min_row=1, max_row=len(data.tasks_by_priority) + 1)
        pie.add_data(pie_data, titles_from_data=True)
        pie.set_categories(labels)
        pie.dataLabels = DataLabelList()
        pie.dataLabels.showPercent = True
        pie.dataLabels.showVal = False
        pie.width = 12
        pie.height = 10
        pri_ws.add_chart(pie, "E2")
    autosize(pri_ws)

    # Projects + bar
    proj_ws = wb.create_sheet("Projects")
    proj_ws.append(["Project", "Count", "Hours"])
    style_header(proj_ws)
    for i in data.work_by_project:
        proj_ws.append([i.label, i.count, i.hours])
    if data.work_by_project:
        chart = BarChart()
        chart.type = "bar"
        chart.title = "Hours by project"
        chart.y_axis.title = "Project"
        chart.x_axis.title = "Hours"
        data_ref = Reference(proj_ws, min_col=3, min_row=1, max_row=len(data.work_by_project) + 1)
        cats = Reference(proj_ws, min_col=1, min_row=2, max_row=len(data.work_by_project) + 1)
        chart.add_data(data_ref, titles_from_data=True)
        chart.set_categories(cats)
        chart.shape = 4
        chart.width = 16
        chart.height = 10
        proj_ws.add_chart(chart, "E2")
    autosize(proj_ws)

    # Status sheet
    status_ws = wb.create_sheet("Task Status")
    status_ws.append(["Status", "Count"])
    style_header(status_ws)
    status_rows = [
        ("Completed", data.tasks.completed),
        ("In progress", data.tasks.in_progress),
        ("In review", data.tasks.in_review),
        ("To do", data.tasks.pending),
        ("On hold", data.tasks.on_hold),
        ("Overdue", data.tasks.overdue),
    ]
    for label, count in status_rows:
        status_ws.append([label, count])
    pie = PieChart()
    pie.title = "Task status breakdown"
    labels = Reference(status_ws, min_col=1, min_row=2, max_row=6)
    pie_data = Reference(status_ws, min_col=2, min_row=1, max_row=6)
    pie.add_data(pie_data, titles_from_data=True)
    pie.set_categories(labels)
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    pie.width = 12
    pie.height = 10
    status_ws.add_chart(pie, "E2")
    autosize(status_ws)

    # Cover note
    note = wb.create_sheet("About", 0)
    note["A1"] = "Workstation Employee Portal"
    note["A1"].font = Font(bold=True, size=16, color="0B2545")
    note["A2"] = "Full performance export with summary metrics and embedded Excel charts."
    note["A3"] = f"Employee: {employee_name}"
    note["A4"] = f"Email: {email}"
    note["A5"] = f"Range: {data.start_date} → {data.end_date} ({data.period.value})"
    note["A7"] = "Sheets included"
    note["A7"].fill = gold_fill
    note["A7"].font = Font(bold=True, color="0B2545")
    for idx, name in enumerate(
        ["Summary", "Trend (charts)", "Priority (pie chart)", "Projects (bar chart)", "Task Status (pie chart)"],
        start=8,
    ):
        note[f"A{idx}"] = name
    autosize(note)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def _flatten_task_entries(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flat: list[dict[str, Any]] = []
    for r in rows:
        details = r.get("entries_detail") or []
        if not details:
            continue
        for e in details:
            flat.append(
                {
                    "report_date": r.get("report_date"),
                    "report_status": r.get("status"),
                    "task_title": e.get("task_title") or "",
                    "project_id": e.get("project_id"),
                    "project": e.get("project") or "Personal",
                    "hours": float(e.get("hours") or 0),
                    "work_status": e.get("work_status") or "",
                    "work_description": e.get("work_description") or "",
                    "achievement": e.get("achievement") or "",
                    "challenges": e.get("challenges") or "",
                    "next_day_plan": e.get("next_day_plan") or "",
                }
            )
    return flat


def _group_tasks_by_project(
    entries: list[dict[str, Any]],
) -> list[tuple[str, list[dict[str, Any]]]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    for e in entries:
        key = str(e.get("project") or "Personal")
        buckets.setdefault(key, []).append(e)
    for tasks in buckets.values():
        tasks.sort(
            key=lambda t: (
                str(t.get("report_date") or ""),
                str(t.get("task_title") or "").lower(),
            ),
            reverse=True,
        )
    named = sorted(((k, v) for k, v in buckets.items() if k != "Personal"), key=lambda x: x[0].lower())
    personal = [("Personal", buckets["Personal"])] if "Personal" in buckets else []
    return named + personal


def _safe_sheet_name(name: str, used: set[str]) -> str:
    cleaned = "".join(ch if ch not in "[]:*?/\\" else " " for ch in name).strip() or "Project"
    cleaned = cleaned[:28]
    base = cleaned
    i = 1
    while cleaned in used:
        cleaned = f"{base[:25]} {i}"
        i += 1
    used.add(cleaned)
    return cleaned


def build_reports_excel(rows: list[dict[str, Any]], *, employee_name: str) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Daily Reports"
    headers = [
        "Report date",
        "Status",
        "Submitted at",
        "Entries",
        "Total hours",
        "Task names",
        "Projects",
        "Admin feedback",
        "Employee response",
    ]
    ws.append(headers)
    header_fill = PatternFill("solid", fgColor="0B2545")
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = Font(color="FFFFFF", bold=True)

    status_counts: dict[str, int] = {}
    hours_by_date: list[tuple[str, float]] = []
    for r in rows:
        ws.append(
            [
                r.get("report_date"),
                r.get("status"),
                r.get("submitted_at"),
                r.get("entry_count"),
                r.get("total_hours"),
                r.get("tasks"),
                r.get("projects"),
                r.get("admin_feedback"),
                r.get("employee_response"),
            ]
        )
        status = str(r.get("status") or "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
        hours_by_date.append((str(r.get("report_date")), float(r.get("total_hours") or 0)))

    for col in ws.columns:
        width = max(len(str(c.value or "")) for c in col) + 2
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(width, 12), 48)

    flat_entries = _flatten_task_entries(rows)
    by_project = _group_tasks_by_project(flat_entries)
    gold_fill = PatternFill("solid", fgColor="C9A227")
    section_font = Font(bold=True, color="0B2545", size=12)

    # Project-wise overview + individual tasks
    project_ws = wb.create_sheet("By Project", 1)
    project_ws.append(
        [
            "Project",
            "Report date",
            "Task name",
            "Hours",
            "Work status",
            "Work description",
            "Achievement",
            "Challenges",
            "Next-day plan",
        ]
    )
    for cell in project_ws[1]:
        cell.fill = header_fill
        cell.font = Font(color="FFFFFF", bold=True)

    row_idx = 2
    for project_name, tasks in by_project:
        total_hours = round(sum(float(t.get("hours") or 0) for t in tasks), 2)
        project_ws.cell(row=row_idx, column=1, value=f"{project_name}  ·  {len(tasks)} tasks  ·  {total_hours}h")
        for col in range(1, 10):
            project_ws.cell(row=row_idx, column=col).fill = gold_fill
            project_ws.cell(row=row_idx, column=col).font = section_font
        row_idx += 1
        for t in tasks:
            project_ws.append(
                [
                    project_name,
                    t.get("report_date"),
                    t.get("task_title"),
                    t.get("hours"),
                    t.get("work_status"),
                    t.get("work_description"),
                    t.get("achievement"),
                    t.get("challenges"),
                    t.get("next_day_plan"),
                ]
            )
            row_idx += 1
        project_ws.append([])
        row_idx += 1

    for col in project_ws.columns:
        width = max(len(str(c.value or "")) for c in col) + 2
        project_ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(width, 12), 48)

    # Individual sheet per project
    used_names: set[str] = {"Daily Reports", "By Project", "Charts", "Project Summary"}
    for project_name, tasks in by_project:
        sheet_name = _safe_sheet_name(project_name, used_names)
        pws = wb.create_sheet(sheet_name)
        pws["A1"] = f"Project: {project_name}"
        pws["A1"].font = Font(bold=True, size=14, color="0B2545")
        pws["A2"] = f"Employee: {employee_name}"
        pws["A3"] = f"Tasks: {len(tasks)} · Total hours: {round(sum(float(t.get('hours') or 0) for t in tasks), 2)}"
        pws.append([])
        pws.append(
            [
                "Report date",
                "Task name",
                "Hours",
                "Work status",
                "Work description",
                "Achievement",
                "Challenges",
                "Next-day plan",
            ]
        )
        header_row = pws.max_row
        for cell in pws[header_row]:
            cell.fill = header_fill
            cell.font = Font(color="FFFFFF", bold=True)
        for t in tasks:
            pws.append(
                [
                    t.get("report_date"),
                    t.get("task_title"),
                    t.get("hours"),
                    t.get("work_status"),
                    t.get("work_description"),
                    t.get("achievement"),
                    t.get("challenges"),
                    t.get("next_day_plan"),
                ]
            )
        for col in pws.columns:
            width = max(len(str(c.value or "")) for c in col) + 2
            pws.column_dimensions[get_column_letter(col[0].column)].width = min(max(width, 12), 48)

    # Charts sheet
    chart_ws = wb.create_sheet("Charts")
    chart_ws.append(["Status", "Count"])
    for k, v in status_counts.items():
        chart_ws.append([k, v])
    if status_counts:
        pie = PieChart()
        pie.title = "Reports by status"
        labels = Reference(chart_ws, min_col=1, min_row=2, max_row=len(status_counts) + 1)
        data = Reference(chart_ws, min_col=2, min_row=1, max_row=len(status_counts) + 1)
        pie.add_data(data, titles_from_data=True)
        pie.set_categories(labels)
        pie.dataLabels = DataLabelList()
        pie.dataLabels.showPercent = True
        pie.width = 12
        pie.height = 10
        chart_ws.add_chart(pie, "D2")

    chart_ws.append([])
    start = len(status_counts) + 4
    chart_ws.cell(row=start, column=1, value="Report date")
    chart_ws.cell(row=start, column=2, value="Hours")
    for i, (d, h) in enumerate(hours_by_date, start=start + 1):
        chart_ws.cell(row=i, column=1, value=d)
        chart_ws.cell(row=i, column=2, value=h)
    if hours_by_date:
        bar = BarChart()
        bar.type = "col"
        bar.title = f"Hours logged — {employee_name}"
        data_ref = Reference(chart_ws, min_col=2, min_row=start, max_row=start + len(hours_by_date))
        cats = Reference(chart_ws, min_col=1, min_row=start + 1, max_row=start + len(hours_by_date))
        bar.add_data(data_ref, titles_from_data=True)
        bar.set_categories(cats)
        bar.width = 18
        bar.height = 9
        chart_ws.add_chart(bar, "D18")

    # Hours by project chart data
    proj_start = start + len(hours_by_date) + 3
    chart_ws.cell(row=proj_start, column=1, value="Project")
    chart_ws.cell(row=proj_start, column=2, value="Hours")
    for i, (project_name, tasks) in enumerate(by_project, start=proj_start + 1):
        chart_ws.cell(row=i, column=1, value=project_name)
        chart_ws.cell(row=i, column=2, value=round(sum(float(t.get("hours") or 0) for t in tasks), 2))
    if by_project:
        pbar = BarChart()
        pbar.type = "bar"
        pbar.title = "Hours by project"
        pdata = Reference(chart_ws, min_col=2, min_row=proj_start, max_row=proj_start + len(by_project))
        pcats = Reference(chart_ws, min_col=1, min_row=proj_start + 1, max_row=proj_start + len(by_project))
        pbar.add_data(pdata, titles_from_data=True)
        pbar.set_categories(pcats)
        pbar.width = 16
        pbar.height = 9
        chart_ws.add_chart(pbar, "D34")

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def build_reports_pdf(rows: list[dict[str, Any]], *, employee_name: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=0.55 * inch, rightMargin=0.55 * inch)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("T", parent=styles["Heading1"], textColor=colors.HexColor(NAVY), fontSize=16)
    story: list[Any] = [
        Paragraph("Workstation · Daily Report History", title),
        Paragraph(
            f"{employee_name} · {len(rows)} reports · Generated {date.today().isoformat()}",
            ParagraphStyle("S", parent=styles["Normal"], textColor=colors.HexColor(MUTED), fontSize=9, spaceAfter=12),
        ),
    ]

    # Status chart
    status_counts: dict[str, int] = {}
    for r in rows:
        status = str(r.get("status") or "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    if status_counts:
        fig, ax = plt.subplots(figsize=(5.5, 3.2))
        ax.pie(
            list(status_counts.values()),
            labels=list(status_counts.keys()),
            autopct="%1.0f%%",
            colors=["#10B981", "#0EA5E9", GOLD, "#F59E0B", "#94A3B8"][: len(status_counts)],
            textprops={"fontsize": 8},
        )
        ax.set_title("Reports by status", color=NAVY)
        fig.tight_layout()
        story.append(Image(io.BytesIO(_fig_to_png(fig)), width=5.2 * inch, height=3.0 * inch))

    if rows:
        fig, ax = plt.subplots(figsize=(7.0, 2.8))
        xs = [str(r.get("report_date"))[5:] for r in rows]
        ys = [float(r.get("total_hours") or 0) for r in rows]
        ax.bar(xs, ys, color=NAVY)
        ax.set_title("Hours by report date", color=NAVY, fontsize=11)
        ax.tick_params(axis="x", rotation=40, labelsize=7)
        _style_axes(ax)
        fig.tight_layout()
        story.append(Image(io.BytesIO(_fig_to_png(fig)), width=6.6 * inch, height=2.6 * inch))

    cell = ParagraphStyle(
        "Cell",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0F172A"),
    )
    table_data = [["Date", "Status", "Hours", "Task names", "Projects"]]
    for r in rows:
        table_data.append(
            [
                str(r.get("report_date") or ""),
                str(r.get("status") or ""),
                f"{float(r.get('total_hours') or 0):.1f}",
                Paragraph(str(r.get("tasks") or "—")[:180], cell),
                Paragraph(str(r.get("projects") or "—")[:80], cell),
            ]
        )
    if len(table_data) == 1:
        table_data.append(["—", "—", "0.0", "—", "—"])
    tbl = Table(
        table_data,
        colWidths=[0.95 * inch, 0.95 * inch, 0.55 * inch, 2.55 * inch, 1.35 * inch],
    )
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(NAVY)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 7.5),
                ("FONTSIZE", (0, 1), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E8EEF5")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F6F8FB")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(tbl)

    # Project-wise individual task reports
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        textColor=colors.HexColor(NAVY),
        fontSize=12,
        spaceBefore=14,
        spaceAfter=4,
    )
    project_title = ParagraphStyle(
        "ProjectTitle",
        parent=styles["Heading3"],
        textColor=colors.HexColor(NAVY),
        fontSize=10,
        spaceBefore=10,
        spaceAfter=4,
    )
    meta = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        textColor=colors.HexColor(MUTED),
        fontSize=8,
        spaceAfter=6,
    )
    story.append(Paragraph("Project-wise task reports", section_title))

    flat_entries = _flatten_task_entries(rows)
    by_project = _group_tasks_by_project(flat_entries)

    if by_project:
        fig, ax = plt.subplots(figsize=(6.5, 2.8))
        labels = [name[:22] for name, _ in by_project]
        hours = [sum(float(t.get("hours") or 0) for t in tasks) for _, tasks in by_project]
        ax.barh(labels, hours, color=NAVY)
        ax.set_title("Hours by project", color=NAVY, fontsize=11)
        ax.set_xlabel("Hours")
        _style_axes(ax)
        fig.tight_layout()
        story.append(Image(io.BytesIO(_fig_to_png(fig)), width=6.2 * inch, height=2.6 * inch))

    if not by_project:
        story.append(Paragraph("No task entries found for this export.", meta))
    else:
        for project_name, tasks in by_project:
            total_h = round(sum(float(t.get("hours") or 0) for t in tasks), 2)
            story.append(
                Paragraph(
                    f"{project_name}",
                    project_title,
                )
            )
            story.append(
                Paragraph(
                    f"{len(tasks)} task{'s' if len(tasks) != 1 else ''} · {total_h:.1f} hours",
                    meta,
                )
            )
            detail_data = [["Date", "Task name", "Hours", "Status", "Work description"]]
            for t in tasks:
                detail_data.append(
                    [
                        str(t.get("report_date") or ""),
                        Paragraph(str(t.get("task_title") or "—")[:70], cell),
                        f"{float(t.get('hours') or 0):.1f}",
                        str(t.get("work_status") or ""),
                        Paragraph(str(t.get("work_description") or "—")[:120], cell),
                    ]
                )
            detail_tbl = Table(
                detail_data,
                colWidths=[0.9 * inch, 1.7 * inch, 0.5 * inch, 0.85 * inch, 2.4 * inch],
            )
            detail_tbl.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(GOLD)),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor(NAVY)),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
                        ("FONTSIZE", (0, 1), (-1, -1), 7),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E8EEF5")),
                        (
                            "ROWBACKGROUNDS",
                            (0, 1),
                            (-1, -1),
                            [colors.white, colors.HexColor("#FFF8E7")],
                        ),
                        ("LEFTPADDING", (0, 0), (-1, -1), 3),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            story.append(detail_tbl)

    doc.build(story)
    return buffer.getvalue()
