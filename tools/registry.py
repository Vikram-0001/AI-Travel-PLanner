"""
tools/registry.py
-----------------
Central registry that:
  1. Defines the JSON Schema for every tool (sent to Groq as `tools`)
  2. Maps tool names → Python callables for execution
  3. Provides the `execute_tool` dispatcher used by the agent loop
"""

from __future__ import annotations

import json
from typing import Any

from core.models import ToolResult
from tools.flights import search_flights
from tools.hotels import search_hotels
from tools.weather import get_weather_forecast
from tools.attractions import search_attractions
from tools.budget import calculate_budget, currency_convert, haversine_distance


# ── Tool JSON Schemas (Groq / OpenAI function-calling format) ─────────────────

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_flights",
            "description": (
                "Search for flight offers between two airports using Amadeus. "
                "Use IATA codes where possible. Returns up to 3 ranked offers."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "origin": {"type": "string", "description": "IATA origin airport/city code, e.g. DEL"},
                    "destination": {"type": "string", "description": "IATA destination airport/city code, e.g. LHR"},
                    "departure_date": {"type": "string", "description": "Departure date in YYYY-MM-DD format"},
                    "return_date": {"type": "string", "description": "Return date YYYY-MM-DD (omit for one-way)"},
                    "adults": {"type": "integer", "default": 1, "description": "Number of adult passengers"},
                    "children": {"type": "integer", "default": 0, "description": "Number of child passengers"},
                    "max_results": {"type": "integer", "default": 3},
                    "currency": {"type": "string", "default": "USD"},
                },
                "required": ["origin", "destination", "departure_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_hotels",
            "description": (
                "Search for hotel offers in a city using Amadeus. "
                "Returns ranked offers with price, room type, and cancellation info."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "city_code": {"type": "string", "description": "IATA city code, e.g. PAR for Paris"},
                    "check_in": {"type": "string", "description": "Check-in date YYYY-MM-DD"},
                    "check_out": {"type": "string", "description": "Check-out date YYYY-MM-DD"},
                    "adults": {"type": "integer", "default": 1},
                    "max_results": {"type": "integer", "default": 3},
                    "currency": {"type": "string", "default": "USD"},
                    "ratings": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Star ratings to filter by, e.g. [3, 4, 5]",
                    },
                },
                "required": ["city_code", "check_in", "check_out"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather_forecast",
            "description": (
                "Fetch a 5-day weather forecast for a city using OpenWeatherMap. "
                "Returns daily min/max temps (Celsius), conditions, humidity, and wind."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name, e.g. Paris"},
                    "country_code": {"type": "string", "description": "Optional 2-letter country code, e.g. FR"},
                    "days": {"type": "integer", "default": 5, "description": "Number of forecast days (max 5)"},
                },
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_attractions",
            "description": (
                "Find top Points of Interest / attractions at the destination using Amadeus. "
                "Provide coordinates or a city code for fallback."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number", "description": "Latitude of search centre"},
                    "longitude": {"type": "number", "description": "Longitude of search centre"},
                    "city_code": {"type": "string", "description": "IATA city code as fallback (e.g. PAR)"},
                    "radius_km": {"type": "integer", "default": 5},
                    "categories": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "POI category filters, e.g. ['SIGHTS', 'RESTAURANT']",
                    },
                    "max_results": {"type": "integer", "default": 8},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_budget",
            "description": (
                "Create an itemised trip budget breakdown. "
                "Includes flights, hotel, food, local transport, activities, and 10% contingency. "
                "Warns if total exceeds the user's stated budget."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "flight_cost": {"type": "number", "description": "Total flight cost for all passengers"},
                    "hotel_cost_per_night": {"type": "number"},
                    "nights": {"type": "integer", "default": 0},
                    "daily_food_budget": {"type": "number", "default": 50.0},
                    "daily_transport_budget": {"type": "number", "default": 20.0},
                    "activity_budget": {"type": "number", "default": 100.0},
                    "num_travellers": {"type": "integer", "default": 1},
                    "currency": {"type": "string", "default": "USD"},
                    "total_budget": {"type": "number", "description": "User's stated total budget (optional)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "currency_convert",
            "description": "Convert an amount from one currency to another using live FX rates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number"},
                    "from_currency": {"type": "string", "description": "ISO source currency, e.g. INR"},
                    "to_currency": {"type": "string", "description": "ISO target currency, e.g. USD"},
                },
                "required": ["amount", "from_currency", "to_currency"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "haversine_distance",
            "description": "Calculate the straight-line distance between two GPS coordinates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "lat1": {"type": "number"}, "lon1": {"type": "number"},
                    "lat2": {"type": "number"}, "lon2": {"type": "number"},
                },
                "required": ["lat1", "lon1", "lat2", "lon2"],
            },
        },
    },
]


# ── Dispatcher ────────────────────────────────────────────────────────────────

_CALLABLE_MAP: dict[str, Any] = {
    "search_flights": search_flights,
    "search_hotels": search_hotels,
    "get_weather_forecast": get_weather_forecast,
    "search_attractions": search_attractions,
    "calculate_budget": calculate_budget,
    "currency_convert": currency_convert,
    "haversine_distance": haversine_distance,
}


def execute_tool(name: str, arguments_json: str) -> ToolResult:
    """
    Dispatch a tool call by name.

    Parameters
    ----------
    name            : tool function name as declared in TOOL_SCHEMAS
    arguments_json  : JSON string of keyword arguments
    """
    fn = _CALLABLE_MAP.get(name)
    if fn is None:
        return ToolResult(success=False, error=f"Unknown tool: '{name}'")

    try:
        kwargs: dict[str, Any] = json.loads(arguments_json)
        result = fn(**kwargs)

        # haversine returns a plain dict, not ToolResult — normalise it
        if isinstance(result, dict):
            return ToolResult(success=True, data=result)
        return result

    except json.JSONDecodeError as exc:
        return ToolResult(success=False, error=f"Bad tool arguments JSON: {exc}")
    except TypeError as exc:
        return ToolResult(success=False, error=f"Tool argument error for '{name}': {exc}")
    except Exception as exc:
        return ToolResult(success=False, error=f"Tool '{name}' raised: {exc}")
