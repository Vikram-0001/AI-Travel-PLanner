"""
tools/flights.py
----------------
Searches for one-way or round-trip flights via the Amadeus Flight Offers
Search API (v2).  Falls back to a structured placeholder on failure so the
agent can still reason about costs.
"""

from __future__ import annotations

import os
from typing import Any, Optional
import requests

from core.amadeus_auth import AmadeusAuth
from core.models import ToolResult


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_offer(offer: dict[str, Any]) -> dict[str, Any]:
    """Flatten a raw Amadeus offer into a concise dict."""
    price = offer.get("price", {})
    itineraries = offer.get("itineraries", [])

    legs: list[dict[str, Any]] = []
    for itin in itineraries:
        for seg in itin.get("segments", []):
            legs.append({
                "from": seg["departure"]["iataCode"],
                "to": seg["arrival"]["iataCode"],
                "dep": seg["departure"]["at"],
                "arr": seg["arrival"]["at"],
                "carrier": seg.get("carrierCode", "??"),
                "flight_no": seg.get("carrierCode", "") + seg.get("number", ""),
                "duration": itin.get("duration", ""),
                "stops": len(itin.get("segments", [])) - 1,
            })

    return {
        "id": offer.get("id"),
        "total_price": float(price.get("grandTotal", 0)),
        "currency": price.get("currency", "USD"),
        "seats_left": offer.get("numberOfBookableSeats"),
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
    Search for flight offers.

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
    base_url = os.getenv("AMADEUS_BASE_URL", "https://test.api.amadeus.com")
    endpoint = f"{base_url}/v2/shopping/flight-offers"

    params: dict[str, Any] = {
        "originLocationCode": origin.upper(),
        "destinationLocationCode": destination.upper(),
        "departureDate": departure_date,
        "adults": adults,
        "max": max_results,
        "currencyCode": currency,
        "nonStop": "false",
    }
    if return_date:
        params["returnDate"] = return_date
    if children > 0:
        params["children"] = children

    try:
        resp = requests.get(
            endpoint,
            headers=AmadeusAuth.headers(),
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        raw_offers = resp.json().get("data", [])

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

        parsed = [_parse_offer(o) for o in raw_offers[:max_results]]
        return ToolResult(success=True, data=parsed)

    except requests.HTTPError as exc:
        # Amadeus test sandbox often rejects obscure routes — degrade gracefully
        fallback = {
            "note": "Live flight search unavailable; estimated prices shown.",
            "estimated_offers": [
                {
                    "id": "est-1",
                    "total_price": 450.0,
                    "currency": currency,
                    "seats_left": None,
                    "legs": [{"from": origin, "to": destination,
                               "dep": f"{departure_date}T08:00",
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
            fallback_note="Amadeus returned an error; showing estimated data instead.",
        )
    except Exception as exc:
        return ToolResult(success=False, error=f"Flight search failed: {exc}")
