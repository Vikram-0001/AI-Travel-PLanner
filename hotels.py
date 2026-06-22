"""
tools/hotels.py
---------------
Two-step hotel search using the Amadeus Hotel Search API:
  1. /v1/reference-data/locations/hotels/by-city   → get hotel IDs
  2. /v3/shopping/hotel-offers                      → get live prices

Falls back gracefully when either call fails.
"""

from __future__ import annotations

import os
from typing import Any, Optional
import requests

from core.amadeus_auth import AmadeusAuth
from core.models import ToolResult


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_hotel_offer(offer: dict[str, Any]) -> dict[str, Any]:
    hotel = offer.get("hotel", {})
    offers_list = offer.get("offers", [{}])
    best = offers_list[0] if offers_list else {}
    price = best.get("price", {})
    room = best.get("room", {})

    return {
        "hotel_id": hotel.get("hotelId"),
        "name": hotel.get("name", "Unknown Hotel"),
        "rating": hotel.get("rating"),
        "latitude": hotel.get("latitude"),
        "longitude": hotel.get("longitude"),
        "check_in": best.get("checkInDate"),
        "check_out": best.get("checkOutDate"),
        "room_type": room.get("typeEstimated", {}).get("category", "Standard"),
        "beds": room.get("typeEstimated", {}).get("beds"),
        "price_per_night": float(price.get("base", 0) or 0),
        "total_price": float(price.get("total", 0) or 0),
        "currency": price.get("currency", "USD"),
        "cancellable": best.get("policies", {}).get("cancellations") is not None,
    }


# ── Main tool function ────────────────────────────────────────────────────────

def search_hotels(
    city_code: str,
    check_in: str,          # YYYY-MM-DD
    check_out: str,         # YYYY-MM-DD
    adults: int = 1,
    max_results: int = 3,
    currency: str = "USD",
    ratings: Optional[list[int]] = None,   # e.g. [3, 4, 5]
) -> ToolResult:
    """
    Search for hotel offers in a city.

    Parameters
    ----------
    city_code   : IATA city code, e.g. "PAR" for Paris
    check_in    : "YYYY-MM-DD"
    check_out   : "YYYY-MM-DD"
    adults      : number of guests
    max_results : number of offers to return
    currency    : ISO currency code
    ratings     : star-rating filter list (optional)
    """
    base_url = os.getenv("AMADEUS_BASE_URL", "https://test.api.amadeus.com")

    # ── Step 1: resolve hotel IDs for the city ────────────────────────────────
    try:
        loc_params: dict[str, Any] = {
            "cityCode": city_code.upper(),
            "radius": 20,
            "radiusUnit": "KM",
            "hotelSource": "ALL",
        }
        if ratings:
            loc_params["ratings"] = ",".join(str(r) for r in ratings)

        loc_resp = requests.get(
            f"{base_url}/v1/reference-data/locations/hotels/by-city",
            headers=AmadeusAuth.headers(),
            params=loc_params,
            timeout=15,
        )
        loc_resp.raise_for_status()
        hotel_ids = [h["hotelId"] for h in loc_resp.json().get("data", [])[:20]]

        if not hotel_ids:
            return ToolResult(
                success=False,
                error=f"No hotels found for city code '{city_code}'.",
                fallback_used=True,
                fallback_note="Try a different IATA city code (e.g. 'PAR' for Paris).",
            )

    except Exception as exc:
        return ToolResult(
            success=False,
            error=f"Hotel location lookup failed: {exc}",
            fallback_used=True,
            fallback_note="Could not reach Amadeus hotel location API.",
        )

    # ── Step 2: fetch live offers for those hotel IDs ─────────────────────────
    try:
        offer_resp = requests.get(
            f"{base_url}/v3/shopping/hotel-offers",
            headers=AmadeusAuth.headers(),
            params={
                "hotelIds": ",".join(hotel_ids[:20]),
                "checkInDate": check_in,
                "checkOutDate": check_out,
                "adults": adults,
                "currencyCode": currency,
                "bestRateOnly": "true",
            },
            timeout=20,
        )
        offer_resp.raise_for_status()
        raw_offers = offer_resp.json().get("data", [])

        if not raw_offers:
            return ToolResult(
                success=False,
                error="No available hotel offers for these dates.",
                fallback_used=True,
                fallback_note="Hotels may be fully booked; try different dates.",
            )

        parsed = [_parse_hotel_offer(o) for o in raw_offers[:max_results]]
        return ToolResult(success=True, data=parsed)

    except requests.HTTPError as exc:
        # Provide estimated fallback
        fallback = [
            {
                "name": f"Estimated Hotel in {city_code}",
                "rating": 3,
                "room_type": "Standard",
                "price_per_night": 80.0,
                "total_price": 80.0,
                "currency": currency,
                "note": "Live pricing unavailable; estimate only.",
            }
        ]
        return ToolResult(
            success=False,
            data=fallback,
            error=str(exc),
            fallback_used=True,
            fallback_note="Amadeus hotel offers API error; showing estimates.",
        )
    except Exception as exc:
        return ToolResult(success=False, error=f"Hotel search failed: {exc}")
