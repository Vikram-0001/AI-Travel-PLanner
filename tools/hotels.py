"""
tools/hotels.py
---------------
Hotel search using the Serp API (Google Hotels).
Falls back gracefully when the call fails.
"""

from __future__ import annotations

import os
from typing import Any, Optional
import requests

from core.models import ToolResult

# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_hotel_offer(property_data: dict[str, Any], currency: str, check_in: str, check_out: str) -> dict[str, Any]:
    name = property_data.get("name", "Unknown Hotel")
    
    # SerpAPI typically returns hotel_class as integer (e.g. 4)
    hotel_class = property_data.get("hotel_class", 3)
    
    gps = property_data.get("gps_coordinates", {})
    latitude = gps.get("latitude")
    longitude = gps.get("longitude")
    
    # Price
    rate_per_night = property_data.get("rate_per_night", {}).get("extracted_lowest", 0)
    total_rate = property_data.get("total_rate", {}).get("extracted_lowest", 0)
    
    # Fallback to rate_per_night if total_rate is missing
    if total_rate == 0 and rate_per_night > 0:
        total_rate = rate_per_night # Just a fallback, true calculation requires date math
        
    return {
        "hotel_id": property_data.get("type", "hotel") + "_" + name.replace(" ", "_"),
        "name": name,
        "rating": str(hotel_class),
        "latitude": latitude,
        "longitude": longitude,
        "check_in": check_in,
        "check_out": check_out,
        "room_type": "Standard", # Google Hotels doesn't always specify room type at the top level
        "beds": None,
        "price_per_night": float(rate_per_night),
        "total_price": float(total_rate),
        "currency": currency,
        "cancellable": True, # Hard to know without deep link, default True
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
    Search for hotel offers using Serp API (Google Hotels).
    
    Parameters
    ----------
    city_code   : IATA city code or location string
    check_in    : "YYYY-MM-DD"
    check_out   : "YYYY-MM-DD"
    adults      : number of guests
    max_results : number of offers to return
    currency    : ISO currency code
    ratings     : star-rating filter list (optional)
    """
    api_key = os.getenv("SERP_API_KEY", "")
    
    if not api_key:
        return ToolResult(
            success=False,
            error="SERP_API_KEY is not set in environment.",
        )

    endpoint = "https://serpapi.com/search.json"

    # Use city_code as the query. SerpAPI resolves "PAR" or "Paris" to hotels there.
    params: dict[str, Any] = {
        "engine": "google_hotels",
        "api_key": api_key,
        "q": city_code,
        "check_in_date": check_in,
        "check_out_date": check_out,
        "adults": adults,
        "currency": currency,
        "hl": "en",
    }
    
    if ratings:
        # SerpAPI google_hotels allows filtering by hotel class via 'hotel_classes' parameter (e.g. "3,4,5")
        params["hotel_classes"] = ",".join(str(r) for r in ratings)

    try:
        resp = requests.get(
            endpoint,
            params=params,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        
        properties = data.get("properties", [])
        
        if not properties:
            return ToolResult(
                success=False,
                error="No available hotel offers for these dates.",
                fallback_used=True,
                fallback_note="Hotels may be fully booked or location not found; try different dates/locations.",
            )

        parsed = []
        for prop in properties[:max_results]:
            p = _parse_hotel_offer(prop, currency, check_in, check_out)
            parsed.append(p)
            
        return ToolResult(success=True, data=parsed)

    except requests.HTTPError as exc:
        fallback = [
            {
                "name": f"Estimated Hotel in {city_code}",
                "rating": "3",
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
            fallback_note="Serp API error; showing estimates.",
        )
    except Exception as exc:
        return ToolResult(success=False, error=f"Hotel search failed: {exc}")
