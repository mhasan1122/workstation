from fastapi import APIRouter

from app.api.routes import (
    auth,
    dashboard,
    health,
    milestones,
    notifications,
    performance,
    profile,
    projects,
    reports,
    tasks,
)

# Unprefixed (health checks)
health_router = health.router

# Everything below is served under /api
api_router = APIRouter(prefix="/api")
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(tasks.router)
api_router.include_router(projects.router)
api_router.include_router(milestones.router)
api_router.include_router(reports.router)
api_router.include_router(performance.router)
api_router.include_router(notifications.router)
api_router.include_router(profile.router)
