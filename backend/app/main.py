import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401  (register all models on Base.metadata)
from app.api.routes import api_router, health_router
from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine

logger = logging.getLogger("app")
settings = get_settings()

# Must exist before StaticFiles is mounted.
settings.upload_path.mkdir(parents=True, exist_ok=True)


def _ensure_schema() -> None:
    """Lightweight additive migrations for existing deployments."""
    from sqlalchemy import text

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE daily_report_entries
                ADD COLUMN IF NOT EXISTS project_name VARCHAR(200)
                """
            )
        )
        # Backfill snapshot names from live project rows where possible.
        conn.execute(
            text(
                """
                UPDATE daily_report_entries e
                SET project_name = p.name
                FROM projects p
                WHERE e.project_id = p.id
                  AND (e.project_name IS NULL OR e.project_name = '')
                """
            )
        )


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Concurrent workers / partial create — tables may already exist.
        logger.exception("create_all raised; continuing if schema is already present")
        Base.metadata.create_all(bind=engine, checkfirst=True)
    try:
        _ensure_schema()
    except Exception:
        logger.exception("schema ensure failed")
    if settings.seed_on_startup:
        from app.seed import run_seed

        with SessionLocal() as db:
            run_seed(db)
    yield


app = FastAPI(
    title=settings.app_name,
    description="Employee Work & Performance Management API (shares auth with the Admin Panel)",
    version="1.0.0",
    debug=settings.app_debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=settings.upload_path), name="uploads")


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"message": f"Welcome to {settings.app_name}", "docs": "/docs"}
