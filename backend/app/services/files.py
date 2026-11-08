import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

settings = get_settings()

_CHUNK = 1024 * 1024
_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")

BLOCKED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".com", ".scr", ".msi", ".js", ".php", ".py", ".jar",
}  # fmt: skip
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def safe_filename(name: str | None) -> str:
    base = Path(name or "file").name
    stem = _UNSAFE.sub("_", Path(base).stem).strip("._") or "file"
    suffix = _UNSAFE.sub("", Path(base).suffix.lower())
    return f"{stem[:80]}{suffix}"


def file_url(file_path: str | None) -> str | None:
    """Public URL (served from the /uploads static mount) for a stored path."""
    if not file_path:
        return None
    if file_path.startswith(("http://", "https://", "/")):
        return file_path
    return f"/uploads/{file_path}"


def save_upload(
    file: UploadFile,
    subdir: str,
    *,
    images_only: bool = False,
) -> tuple[str, str]:
    """Persist an uploaded file under UPLOAD_DIR/<subdir>/.

    Returns (original_filename, relative_path_for_db).
    """
    original = Path(file.filename or "file").name
    cleaned = safe_filename(original)
    suffix = Path(cleaned).suffix.lower()

    if suffix in BLOCKED_EXTENSIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="This file type is not allowed")
    if images_only and suffix not in IMAGE_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Only image files (jpg, png, gif, webp) are allowed"
        )

    target_dir = settings.upload_path / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{cleaned}"
    target = target_dir / stored_name

    written = 0
    try:
        with target.open("wb") as out:
            while chunk := file.file.read(_CHUNK):
                written += len(chunk)
                if written > settings.max_upload_bytes:
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds {settings.max_upload_size_mb} MB limit",
                    )
                out.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        file.file.close()

    if written == 0:
        target.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    return original[:255], f"{subdir}/{stored_name}"


def delete_stored_file(file_path: str | None) -> None:
    if not file_path or file_path.startswith(("http://", "https://", "/")):
        return
    target = (settings.upload_path / file_path).resolve()
    root = settings.upload_path.resolve()
    if root in target.parents and target.is_file():
        target.unlink(missing_ok=True)

