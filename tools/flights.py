"""
tools/flights.py
----------------
Searches for one-way or round-trip flights via the Serp API (Google Flights).
Falls back to a structured placeholder on failure so the
agent can still reason about costs.
"""

from __future__ import annotations

import os
from typing import Any, Optional
import requests

from core.models import ToolResult


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_offer(offer: dict[str, Any], currency: str) -> dict[str, Any]:
    """Flatten a raw Serp API Google Flights offer into a concise dict."""
    price = offer.get("price", 0)
    flights_data = offer.get("flights", [])

    legs: list[dict[str, Any]] = []
    for leg in flights_data:
        departure = leg.get("departure_airport", {})
        arrival = leg.get("arrival_airport", {})
        legs.append({
            "from": departure.get("id", ""),
            "to": arrival.get("id", ""),
            "dep": departure.get("time", ""),
            "arr": arrival.get("time", ""),
            "carrier": leg.get("airline", "??"),
            "flight_no": leg.get("flight_number", ""),
            "duration": leg.get("duration", 0),
            "stops": len(offer.get("layovers", [])) if len(flights_data) == 1 else 0, # approximation
        })

    return {
        "id": offer.get("departure_token", "unk"),
        "total_price": float(price),
        "currency": currency,
        "seats_left": None,
        "legs": legs,
    }


# ── Main tool function ────────────────────────────────────────────────────────

def search_flights(
    origin: str,
    destination: str,
    departure_date: str,          # YYYY-MM-DD
    return_date: Optional[str] = None,
    adults: int = 1,
    children: int = 0,
    max_results: int = 3,
    currency: str = "USD",
) -> ToolResult:
    """
    Search for flight offers using Serp API (Google Flights).

    Parameters
    ----------
    origin          : IATA airport/city code, e.g. "DEL"
    destination     : IATA airport/city code, e.g. "LHR"
    departure_date  : "YYYY-MM-DD"
    return_date     : "YYYY-MM-DD" or None for one-way
    adults          : number of adult passengers
    children        : number of child passengers (2–11 yrs)
    max_results     : how many offers to return (1-5 recommended)
    currency        : 3-letter ISO currency code
    """
    api_key = os.getenv("SERP_API_KEY", "")
    if not api_key:
        return ToolResult(
            success=False,
            error="SERP_API_KEY is not set in environment.",
        )

    endpoint = "https://serpapi.com/search.json"

    params: dict[str, Any] = {
        "engine": "google_flights",
        "api_key": api_key,
        "departure_id": origin.upper(),
        "arrival_id": destination.upper(),
        "outbound_date": departure_date,
        "adults": adults,
        "children": children,
        "currency": currency,
        "hl": "en",
    }
    if return_date:
        params["return_date"] = return_date

    try:
        resp = requests.get(
            endpoint,
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        
        raw_offers = data.get("best_flights", [])
        if not raw_offers:
            raw_offers = data.get("other_flights", [])

        if not raw_offers:
            return ToolResult(
                success=False,
                error="No flights found for these criteria.",
                fallback_used=True,
                fallback_note=(
                    f"No live results for {origin}→{destination} on {departure_date}. "
                    "Try nearby airports or different dates."
                ),
            )

        parsed = [_parse_offer(o, currency) for o in raw_offers[:max_results]]
        return ToolResult(success=True, data=parsed)

    except requests.HTTPError as exc:
        fallback = {
            "note": "Live flight search unavailable; estimated prices shown.",
            "estimated_offers": [
                {
                    "id": "est-1",
                    "total_price": 450.0,
                    "currency": currency,
                    "seats_left": None,
                    "legs": [{"from": origin, "to": destination,
                               "dep": f"{departure_date} 08:00",
                               "carrier": "?", "flight_no": "—",
                               "stops": 0}],
                }
            ],
        }
        return ToolResult(
            success=False,
            data=fallback,
            error=str(exc),
            fallback_used=True,
            fallback_note="Serp API returned an error; showing estimated data instead.",
        )
    except Exception as exc:
        return ToolResult(success=False, error=f"Flight search failed: {exc}")
