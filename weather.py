"""
tools/weather.py
----------------
Fetches a 5-day / 3-hour weather forecast from OpenWeatherMap and
summarises it into daily bullet points suitable for the terminal.
"""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime
from typing import Any
import requests

from core.models import ToolResult


# ── Helpers ───────────────────────────────────────────────────────────────────

_CONDITION_EMOJI: dict[str, str] = {
    "Clear": "☀️",
    "Clouds": "⛅",
    "Rain": "🌧️",
    "Drizzle": "🌦️",
    "Thunderstorm": "⛈️",
    "Snow": "❄️",
    "Mist": "🌫️",
    "Fog": "🌫️",
    "Haze": "🌫️",
}


def _summarise_day(entries: list[dict[str, Any]]) -> dict[str, Any]:
    """Condense a list of 3-hour slots into a single day summary."""
    temps = [e["main"]["temp"] for e in entries]
    feels = [e["main"]["feels_like"] for e in entries]
    humidity = [e["main"]["humidity"] for e in entries]
    descs = [e["weather"][0]["main"] for e in entries]
    winds = [e["wind"]["speed"] for e in entries]

    main_condition = max(set(descs), key=descs.count)
    emoji = _CONDITION_EMOJI.get(main_condition, "🌡️")

    return {
        "condition": main_condition,
        "emoji": emoji,
        "temp_min_c": round(min(temps) - 273.15, 1),
        "temp_max_c": round(max(temps) - 273.15, 1),
        "feels_like_c": round(sum(feels) / len(feels) - 273.15, 1),
        "humidity_pct": round(sum(humidity) / len(humidity)),
        "wind_kmh": round((sum(winds) / len(winds)) * 3.6, 1),
        "description": entries[len(entries) // 2]["weather"][0]["description"].title(),
    }


# ── Main tool function ────────────────────────────────────────────────────────

def get_weather_forecast(
    city: str,
    country_code: str = "",        # optional ISO-3166 code, e.g. "FR"
    days: int = 5,
) -> ToolResult:
    """
    Return a per-day weather summary for `city`.

    Parameters
    ----------
    city         : city name, e.g. "Paris"
    country_code : optional 2-letter country code to disambiguate
    days         : number of forecast days (max 5 for free tier)
    """
    api_key = os.getenv("OPENWEATHER_API_KEY", "")
    if not api_key:
        return ToolResult(
            success=False,
            error="OPENWEATHER_API_KEY not set in .env",
            fallback_used=True,
            fallback_note="Weather data unavailable; check API key.",
        )

    location = f"{city},{country_code}" if country_code else city

    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/forecast",
            params={"q": location, "appid": api_key, "cnt": min(days * 8, 40)},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()

        # Group 3-hour slots by calendar day
        by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for entry in payload.get("list", []):
            day_str = datetime.fromtimestamp(entry["dt"]).strftime("%Y-%m-%d")
            by_day[day_str].append(entry)

        daily = [
            {"date": d, **_summarise_day(slots)}
            for d, slots in sorted(by_day.items())
        ][:days]

        city_info = payload.get("city", {})
        return ToolResult(
            success=True,
            data={
                "city": city_info.get("name", city),
                "country": city_info.get("country", country_code),
                "forecast": daily,
            },
        )

    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "?"
        msg = f"OpenWeather API error {status}"
        if status == 404:
            msg = f"City '{city}' not found in OpenWeather."
        return ToolResult(
            success=False,
            error=msg,
            fallback_used=True,
            fallback_note="Check city spelling or add country code (e.g. 'London,GB').",
        )
    except Exception as exc:
        return ToolResult(success=False, error=f"Weather fetch failed: {exc}")
