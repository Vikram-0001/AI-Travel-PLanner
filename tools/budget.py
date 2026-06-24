"""
tools/budget.py
---------------
Two utilities in one module:
  1. currency_convert  – live FX rates from ExchangeRate.host
  2. calculate_budget  – trip cost breakdown from known components

The Haversine distance formula is also provided here for convenience.
"""

from __future__ import annotations

import math
import os
from typing import Any, Optional
import requests

from core.models import ToolResult


# ── Currency conversion ───────────────────────────────────────────────────────

def currency_convert(
    amount: float,
    from_currency: str,
    to_currency: str,
) -> ToolResult:
    """
    Convert `amount` from one currency to another using ExchangeRate.host.

    Parameters
    ----------
    amount        : monetary amount to convert
    from_currency : ISO 4217 source currency code (e.g. "INR")
    to_currency   : ISO 4217 target currency code (e.g. "USD")
    """
    api_key = os.getenv("EXCHANGERATE_API_KEY", "")  # optional for free tier

    try:
        # ExchangeRate.host free endpoint (no key needed for basic use)
        url = "https://api.exchangerate.host/convert"
        params: dict[str, Any] = {
            "from": from_currency.upper(),
            "to": to_currency.upper(),
            "amount": amount,
        }
        if api_key:
            params["access_key"] = api_key

        resp = requests.get(url, params=params, timeout=8)
        resp.raise_for_status()
        data = resp.json()

        if not data.get("success", True):
            raise ValueError(data.get("error", {}).get("info", "Unknown API error"))

        converted = data.get("result", 0.0)
        rate = data.get("info", {}).get("rate", converted / amount if amount else 1)

        return ToolResult(
            success=True,
            data={
                "original_amount": amount,
                "from": from_currency.upper(),
                "to": to_currency.upper(),
                "rate": round(rate, 6),
                "converted_amount": round(converted, 2),
            },
        )

    except Exception as exc:
        # Rough static fallback rates (USD base)
        _STATIC_RATES: dict[str, float] = {
            "USD": 1.0, "EUR": 0.92, "GBP": 0.79, "INR": 83.5,
            "JPY": 149.0, "AUD": 1.53, "CAD": 1.36, "SGD": 1.34,
            "AED": 3.67, "THB": 35.5,
        }
        try:
            base_usd = amount / _STATIC_RATES.get(from_currency.upper(), 1.0)
            result = base_usd * _STATIC_RATES.get(to_currency.upper(), 1.0)
            return ToolResult(
                success=True,
                data={
                    "original_amount": amount,
                    "from": from_currency.upper(),
                    "to": to_currency.upper(),
                    "rate": round(_STATIC_RATES.get(to_currency.upper(), 1.0) /
                                  _STATIC_RATES.get(from_currency.upper(), 1.0), 6),
                    "converted_amount": round(result, 2),
                },
                fallback_used=True,
                fallback_note=f"Using cached rates (live API error: {exc}).",
            )
        except Exception:
            return ToolResult(success=False, error=f"Currency conversion failed: {exc}")


# ── Budget calculator ─────────────────────────────────────────────────────────

def calculate_budget(
    flight_cost: Optional[float] = None,
    hotel_cost_per_night: Optional[float] = None,
    nights: int = 0,
    daily_food_budget: float = 4000.0,
    daily_transport_budget: float = 1500.0,
    activity_budget: float = 8000.0,
    num_travellers: int = 1,
    currency: str = "INR",
    total_budget: Optional[float] = None,
) -> ToolResult:
    """
    Build an itemised trip budget and flag if it exceeds the total budget.

    All monetary inputs should be in INR.
    """
    breakdown: dict[str, Any] = {}
    total = 0.0

    if flight_cost is not None:
        breakdown["flights"] = round(flight_cost, 2)
        total += flight_cost

    hotel_total = (hotel_cost_per_night or 0) * nights
    if hotel_cost_per_night and nights:
        breakdown["hotel"] = round(hotel_total, 2)
        total += hotel_total

    food_total = daily_food_budget * nights * num_travellers
    breakdown["food"] = round(food_total, 2)
    total += food_total

    transport_total = daily_transport_budget * nights * num_travellers
    breakdown["local_transport"] = round(transport_total, 2)
    total += transport_total

    breakdown["activities"] = round(activity_budget, 2)
    total += activity_budget

    misc = round(total * 0.10, 2)          # 10% contingency
    breakdown["contingency_10pct"] = misc
    total += misc

    breakdown["TOTAL"] = round(total, 2)
    breakdown["currency"] = currency
    breakdown["per_person"] = round(total / num_travellers, 2) if num_travellers else total

    over_budget: Optional[float] = None
    if total_budget:
        diff = total - total_budget
        if diff > 0:
            over_budget = round(diff, 2)
            breakdown["⚠️  over_budget_by"] = f"{currency} {over_budget:,.2f}"
        else:
            breakdown["✅  under_budget_by"] = f"{currency} {abs(diff):,.2f}"

    return ToolResult(
        success=True,
        data={
            "breakdown": breakdown,
            "over_budget": over_budget,
        },
    )


# ── Haversine distance ────────────────────────────────────────────────────────

def haversine_distance(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
) -> dict[str, float]:
    """
    Calculate the great-circle distance between two GPS points.

    Returns dict with distance in km and miles.
    """
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    km = R * c

    return {"km": round(km, 2), "miles": round(km * 0.621371, 2)}
