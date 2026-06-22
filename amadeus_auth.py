"""
core/amadeus_auth.py
--------------------
Handles Amadeus OAuth2 client-credentials token lifecycle.
Tokens are cached in memory and refreshed automatically on expiry.
"""

from __future__ import annotations

import time
import os
import requests
from typing import Optional


class AmadeusAuth:
    """Singleton-style Amadeus token manager."""

    _token: Optional[str] = None
    _expires_at: float = 0.0

    @classmethod
    def get_token(cls) -> str:
        """Return a valid access token, refreshing if necessary."""
        if cls._token and time.time() < cls._expires_at - 30:
            return cls._token

        client_id = os.getenv("AMADEUS_CLIENT_ID", "")
        client_secret = os.getenv("AMADEUS_CLIENT_SECRET", "")
        base_url = os.getenv("AMADEUS_BASE_URL", "https://test.api.amadeus.com")

        if not client_id or not client_secret:
            raise ValueError(
                "AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET must be set in .env"
            )

        resp = requests.post(
            f"{base_url}/v1/security/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()

        cls._token = payload["access_token"]
        cls._expires_at = time.time() + int(payload.get("expires_in", 1800))
        return cls._token  # type: ignore[return-value]

    @classmethod
    def headers(cls) -> dict[str, str]:
        return {"Authorization": f"Bearer {cls.get_token()}"}
