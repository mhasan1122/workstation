from fastapi import APIRouter

from app.core.deps import CurrentEmployee, DbSession
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard import build_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(user: CurrentEmployee, db: DbSession) -> DashboardResponse:
    return build_dashboard(db, user)
