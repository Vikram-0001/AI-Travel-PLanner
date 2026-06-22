"""
tools/attractions.py
--------------------
Fetches Points of Interest near a location using the Amadeus
Points of Interest API (v1).  Falls back to curated suggestions
when the API is unavailable.
"""

from __future__ import annotations

import os
from typing import Any, Optional
import requests

from core.amadeus_auth import AmadeusAuth
from core.models import ToolResult


# ── Curated fallback data ─────────────────────────────────────────────────────

_FALLBACK_ATTRACTIONS: dict[str, list[dict[str, Any]]] = {
    "PAR": [
        {"name": "Eiffel Tower", "category": "LANDMARK", "rank": 1},
        {"name": "Louvre Museum", "category": "MUSEUM", "rank": 2},
        {"name": "Musée d'Orsay", "category": "MUSEUM", "rank": 3},
        {"name": "Notre-Dame Cathedral", "category": "LANDMARK", "rank": 4},
        {"name": "Montmartre & Sacré-Cœur", "category": "LANDMARK", "rank": 5},
    ],
    "LON": [
        {"name": "British Museum", "category": "MUSEUM", "rank": 1},
        {"name": "Tower of London", "category": "LANDMARK", "rank": 2},
        {"name": "Tate Modern", "category": "MUSEUM", "rank": 3},
        {"name": "Buckingham Palace", "category": "LANDMARK", "rank": 4},
        {"name": "Hyde Park", "category": "PARK", "rank": 5},
    ],
    "NYC": [
        {"name": "Central Park", "category": "PARK", "rank": 1},
        {"name": "Metropolitan Museum of Art", "category": "MUSEUM", "rank": 2},
        {"name": "Statue of Liberty", "category": "LANDMARK", "rank": 3},
        {"name": "Times Square", "category": "LANDMARK", "rank": 4},
        {"name": "Brooklyn Bridge", "category": "LANDMARK", "rank": 5},
    ],
    "DEL": [
        {"name": "Red Fort", "category": "LANDMARK", "rank": 1},
        {"name": "Qutub Minar", "category": "LANDMARK", "rank": 2},
        {"name": "India Gate", "category": "LANDMARK", "rank": 3},
        {"name": "Humayun's Tomb", "category": "LANDMARK", "rank": 4},
        {"name": "Lotus Temple", "category": "LANDMARK", "rank": 5},
    ],
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_poi(poi: dict[str, Any]) -> dict[str, Any]:
    geo = poi.get("geoCode", {})
    return {
        "name": poi.get("name", "Unknown"),
        "category": poi.get("category", "SIGHTSEEING"),
        "subcategories": poi.get("subCategory", []),
        "rank": poi.get("rank"),
        "tags": poi.get("tags", [])[:5],
        "latitude": geo.get("latitude"),
        "longitude": geo.get("longitude"),
    }


# ── Main tool function ────────────────────────────────────────────────────────

def search_attractions(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    city_code: Optional[str] = None,
    radius_km: int = 5,
    categories: Optional[list[str]] = None,   # e.g. ["SIGHTS", "RESTAURANT"]
    max_results: int = 8,
) -> ToolResult:
    """
    Fetch top Points of Interest near a location.

    Provide either (latitude, longitude) or city_code.
    If the API call fails, curated fallback data is returned for known cities.

    Parameters
    ----------
    latitude    : decimal degrees
    longitude   : decimal degrees
    city_code   : IATA city code used as fallback lookup key
    radius_km   : search radius in kilometres (max 20)
    categories  : filter by POI category
    max_results : number of results to return
    """
    base_url = os.getenv("AMADEUS_BASE_URL", "https://test.api.amadeus.com")

    if latitude is None or longitude is None:
        # Without coordinates we jump straight to fallback
        return _use_fallback(city_code, max_results)

    try:
        params: dict[str, Any] = {
            "latitude": latitude,
            "longitude": longitude,
            "radius": min(radius_km, 20),
            "page[limit]": max_results,
        }
        if categories:
            params["categories"] = ",".join(c.upper() for c in categories)

        resp = requests.get(
            f"{base_url}/v1/shopping/activities",
            headers=AmadeusAuth.headers(),
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        raw = resp.json().get("data", [])

        if not raw:
            return _use_fallback(city_code, max_results, note="No activities found via API.")

        parsed = [_parse_poi(p) for p in raw[:max_results]]
        return ToolResult(success=True, data=parsed)

    except Exception as exc:
        return _use_fallback(
            city_code, max_results, note=f"API error: {exc}"
        )


def _use_fallback(
    city_code: Optional[str],
    max_results: int,
    note: Optional[str] = None,
) -> ToolResult:
    """Return curated fallback data for well-known cities."""
    if city_code and city_code.upper() in _FALLBACK_ATTRACTIONS:
        data = _FALLBACK_ATTRACTIONS[city_code.upper()][:max_results]
        return ToolResult(
            success=True,
            data=data,
            fallback_used=True,
            fallback_note=note or "Using curated attraction list (live API unavailable).",
        )
    return ToolResult(
        success=False,
        error=note or "No attraction data available.",
        fallback_used=True,
        fallback_note=(
            "Live POI API unavailable and no curated list for this city. "
            "Try searching travel blogs or Tripadvisor."
        ),
    )
