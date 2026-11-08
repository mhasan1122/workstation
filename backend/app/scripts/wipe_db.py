"""Drop and recreate all tables — removes every row of dummy/seed data."""

from app import models  # noqa: F401
from app.core.database import Base, engine


def main() -> None:
    print("Dropping all tables…")
    Base.metadata.drop_all(bind=engine)
    print("Creating empty schema…")
    Base.metadata.create_all(bind=engine)
    print("Done. Database is empty.")


if __name__ == "__main__":
    main()
