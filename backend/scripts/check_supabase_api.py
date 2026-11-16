from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

TABLES = (
    "societies",
    "users",
    "services",
    "camps",
    "camp_price_tiers",
    "bookings",
    "job_records",
)
SELECT_COLUMNS = {
    "camp_price_tiers": "camp_id",
}


def verify_public_api() -> None:
    base_url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    if not base_url or not anon_key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_ANON_KEY to verify the public API")

    for table_name in TABLES:
        select_column = SELECT_COLUMNS.get(table_name, "id")
        url = (
            f"{base_url.rstrip('/')}/rest/v1/{table_name}?"
            f"{urlencode({'select': select_column, 'limit': 1})}"
        )
        request = Request(
            url,
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
            },
        )
        try:
            with urlopen(request, timeout=15) as response:
                body = json.loads(response.read())
        except HTTPError as error:
            if error.code in {401, 403}:
                raise RuntimeError(
                    f"Public API rejected access to {table_name}; confirm the anon key is valid "
                    "before counting this as RLS verification"
                ) from None
            raise RuntimeError(f"Public API returned HTTP {error.code} for {table_name}") from None
        except URLError as error:
            raise RuntimeError(f"Could not reach the public API for {table_name}: {error.reason}") from None

        if not isinstance(body, list):
            raise RuntimeError(f"Public API returned an unexpected response for {table_name}")
        if body:
            raise RuntimeError(f"The public API exposed rows from {table_name}")

    print("Public API returned no rows for any of the seven MVP tables.")


if __name__ == "__main__":
    verify_public_api()
