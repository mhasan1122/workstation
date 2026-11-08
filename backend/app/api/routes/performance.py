from datetime import date
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.core.deps import CurrentEmployee, DbSession
from app.schemas.performance import PerformancePeriod, PerformanceResponse
from app.services.exports import build_performance_excel, build_performance_pdf
from app.services.performance import build_performance

router = APIRouter(prefix="/performance", tags=["performance"])


@router.get("", response_model=PerformanceResponse)
def get_performance(
    user: CurrentEmployee,
    db: DbSession,
    period: Annotated[
        PerformancePeriod,
        Query(
            description=(
                "weekly = this week (Mon-today), monthly = this month, quarterly = this quarter, "
                "yearly = this year, custom = explicit `start`/`end`"
            )
        ),
    ] = PerformancePeriod.MONTHLY,
    start: date | None = None,
    end: date | None = None,
) -> PerformanceResponse:
    return build_performance(db, user, period, start, end)


@router.get("/export/pdf")
def export_performance_pdf(
    user: CurrentEmployee,
    db: DbSession,
    period: PerformancePeriod = PerformancePeriod.MONTHLY,
    start: date | None = None,
    end: date | None = None,
) -> Response:
    data = build_performance(db, user, period, start, end)
    pdf = build_performance_pdf(
        data,
        employee_name=user.full_name,
        email=user.email,
    )
    filename = f"performance-{data.period.value}-{data.start_date}-{data.end_date}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.get("/export/excel")
def export_performance_excel(
    user: CurrentEmployee,
    db: DbSession,
    period: PerformancePeriod = PerformancePeriod.MONTHLY,
    start: date | None = None,
    end: date | None = None,
) -> Response:
    data = build_performance(db, user, period, start, end)
    xlsx = build_performance_excel(
        data,
        employee_name=user.full_name,
        email=user.email,
    )
    filename = f"performance-{data.period.value}-{data.start_date}-{data.end_date}.xlsx"
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )
