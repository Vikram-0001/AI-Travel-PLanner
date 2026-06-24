"""
core/models.py
--------------
Pydantic v2 data models for the travel planner.
All trip state lives here so every module shares a single source of truth.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Trip Context ──────────────────────────────────────────────────────────────

class TripContext(BaseModel):
    """Structured memory of everything we know about the user's trip so far."""

    origin: Optional[str] = None                   # IATA city / airport code or city name
    destination: Optional[str] = None
    departure_date: Optional[date] = None
    return_date: Optional[date] = None
    num_adults: int = 1
    num_children: int = 0
    budget_usd: Optional[float] = None
    currency: str = "INR"
    trip_style: Optional[str] = None               # "adventure", "relaxing", "cultural", …
    accommodation_type: Optional[str] = None       # "hotel", "hostel", "airbnb", …
    interests: list[str] = Field(default_factory=list)
    special_requirements: list[str] = Field(default_factory=list)

    # Cached results – filled by tool calls
    selected_flight: Optional[dict[str, Any]] = None
    selected_hotel: Optional[dict[str, Any]] = None
    weather_summary: Optional[str] = None
    attractions: list[dict[str, Any]] = Field(default_factory=list)
    budget_breakdown: Optional[dict[str, Any]] = None

    def missing_essentials(self) -> list[str]:
        """Return a list of fields that are still needed to start planning."""
        missing: list[str] = []
        if not self.destination:
            missing.append("destination")
        if not self.departure_date:
            missing.append("departure date")
        if not self.origin:
            missing.append("departure city / airport")
        return missing

    def summary_line(self) -> str:
        """One-line trip summary for display in the terminal."""
        parts: list[str] = []
        if self.origin and self.destination:
            parts.append(f"{self.origin} → {self.destination}")
        if self.departure_date:
            parts.append(str(self.departure_date))
        if self.return_date:
            parts.append(f"(return {self.return_date})")
        travellers = self.num_adults + self.num_children
        parts.append(f"{travellers} traveller{'s' if travellers > 1 else ''}")
        if self.budget_usd:
            parts.append(f"budget ₹{self.budget_usd:,.0f}")
        return "  |  ".join(parts) if parts else "No trip details yet"


# ── Conversation Memory ───────────────────────────────────────────────────────

class Message(BaseModel):
    """A single chat turn."""
    role: str                       # "system" | "user" | "assistant" | "tool"
    content: str
    tool_call_id: Optional[str] = None
    name: Optional[str] = None      # tool name, when role == "tool"


class ConversationMemory(BaseModel):
    """Sliding-window memory with optional summarisation support."""

    messages: list[Message] = Field(default_factory=list)
    summary: Optional[str] = None   # compressed history when window overflows
    window_size: int = 20           # keep this many recent messages verbatim
    keep_after_summary: int = 6     # verbatim tail to preserve after summarising

    def add(self, role: str, content: str, **kwargs: Any) -> None:
        self.messages.append(Message(role=role, content=content, **kwargs))

    def needs_summary(self) -> bool:
        return len(self.messages) > self.window_size

    def trim_to_window(self) -> list[Message]:
        """Return only the most recent `keep_after_summary` messages."""
        return self.messages[-self.keep_after_summary:]

    def to_api_messages(self) -> list[dict[str, Any]]:
        """Convert to the format expected by the Groq / OpenAI chat API."""
        result: list[dict[str, Any]] = []

        # Prepend compressed history if we have a summary
        if self.summary:
            result.append({
                "role": "system",
                "content": f"[CONVERSATION SUMMARY]\n{self.summary}"
            })

        for msg in self.messages:
            entry: dict[str, Any] = {"role": msg.role, "content": msg.content}
            if msg.tool_call_id:
                entry["tool_call_id"] = msg.tool_call_id
            if msg.name:
                entry["name"] = msg.name
            result.append(entry)

        return result


# ── Tool result wrapper ───────────────────────────────────────────────────────

class ToolResult(BaseModel):
    """Standardised wrapper returned by every tool function."""
    success: bool
    data: Any = None
    error: Optional[str] = None
    fallback_used: bool = False
    fallback_note: Optional[str] = None
