from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Workstation Employee Portal API"
    app_debug: bool = True

    # Database
    database_host: str = "localhost"
    database_port: int = 5432
    database_name: str = "workstation"
    database_user: str = "postgres"
    database_password: str = "12345678"

    # Auth (shared with the future Admin Panel - keep SECRET_KEY identical)
    secret_key: str = "change-me-in-production-super-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    reset_token_expire_minutes: int = 60
    otp_expire_minutes: int = 10
    otp_length: int = 6

    # SMTP (Gmail app password)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True

    # Files
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 10

    # CORS (comma separated)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Seeding (keep false — no dummy data)
    seed_on_startup: bool = False

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.database_user}:{self.database_password}"
            f"@{self.database_host}:{self.database_port}/{self.database_name}"
        )

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        if not path.is_absolute():
            path = BASE_DIR / path
        return path

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
