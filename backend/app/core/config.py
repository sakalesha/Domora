# What is the role of this file? 
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL, make_url

BASE_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BASE_DIR / ".env")

_database_url = make_url(os.getenv("DATABASE_URL", "sqlite:///./domora.db"))
if _database_url.drivername in {"postgres", "postgresql"}:
    _database_url = _database_url.set(drivername="postgresql+psycopg")

DATABASE_URL: URL = _database_url
SECRET_KEY = os.getenv("SECRET_KEY", "local-dev-secret")
APP_ENV = os.getenv("APP_ENV", "development")
