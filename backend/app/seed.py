"""Seeding is disabled. The portal uses real registration with email OTP.

Run `python -m app.scripts.wipe_db` to reset the database to an empty schema.
"""

from __future__ import annotations

import sys


def run_seed(*_args, **_kwargs) -> None:
    raise SystemExit(
        "Dummy seed data has been removed. "
        "Register via the Employee Portal (name + email OTP)."
    )


def main() -> None:
    run_seed()


if __name__ == "__main__":
    main()
    sys.exit(1)
