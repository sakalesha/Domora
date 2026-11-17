from __future__ import annotations

import logging
import sys

from app.config import APP_ENV


def setup_logging() -> None:
    """Configure application-wide logging formats and levels."""
    log_level = logging.DEBUG if APP_ENV in {"development", "test"} else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.setLevel(log_level)

    root_logger = logging.getLogger("app")
    root_logger.setLevel(log_level)
    if not root_logger.handlers:
        root_logger.addHandler(handler)


logger = logging.getLogger("app")
