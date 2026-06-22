"""
utils/context_extractor.py
---------------------------
After each assistant turn, we ask the LLM to extract any newly revealed
trip facts and merge them into TripContext.  This keeps structured memory
in sync without requiring rigid user input formats.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from typing import Any, Optional

from groq import Groq

from core.models import TripContext


_EXTRACT_SYSTEM = """You are a structured data extractor.
Given a piece of conversation, extract travel planning details and return
ONLY a valid JSON object (no markdown fences, no explanation) with these
optional keys:

  origin            : string (city or IATA code)
  destination       : string (city or IATA code)
  departure_date    : string (YYYY-MM-DD)
  return_date       : string (YYYY-MM-DD)
  num_adults        : integer
  num_children      : integer
  budget_usd        : float
  currency          : string (ISO-4217)
  trip_style        : string (e.g. "adventure", "relaxing")
  accommodation_type: string (e.g. "hotel", "hostel")
  interests         : list of strings
  special_requirements: list of strings

Include only keys that are explicitly mentioned.  If nothing is found,
return {}.
"""


def extract_trip_context(
    user_message: str,
    assistant_reply: str,
    client: Groq,
    model: str,
    existing: TripContext,
) -> TripContext:
    """
    Merge any trip facts found in the latest exchange into `existing`.
    Returns the updated TripContext (mutated in place AND returned).
    """
    snippet = f"USER: {user_message}\nASSISTANT: {assistant_reply}"

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _EXTRACT_SYSTEM},
                {"role": "user", "content": snippet},
            ],
            max_tokens=300,
            temperature=0.0,
        )
        raw = (resp.choices[0].message.content or "").strip()

        # Strip accidental markdown fences
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

        extracted: dict[str, Any] = json.loads(raw)

        # Merge non-null values into existing context
        for k, v in extracted.items():
            if v is None or v == "" or v == [] or v == {}:
                continue
            if k == "departure_date":
                try:
                    v = datetime.strptime(v, "%Y-%m-%d").date()
                except ValueError:
                    continue
            elif k == "return_date":
                try:
                    v = datetime.strptime(v, "%Y-%m-%d").date()
                except ValueError:
                    continue
            elif k in ("num_adults", "num_children"):
                v = int(v)
            elif k == "budget_usd":
                v = float(v)
            elif k == "interests":
                # Merge lists, deduplicate
                v = list(dict.fromkeys(existing.interests + list(v)))
            elif k == "special_requirements":
                v = list(dict.fromkeys(existing.special_requirements + list(v)))

            if hasattr(existing, k):
                setattr(existing, k, v)

    except (json.JSONDecodeError, Exception):
        # Extraction is best-effort; never crash the main loop
        pass

    return existing
