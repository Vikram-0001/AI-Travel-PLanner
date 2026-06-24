"""
utils/display.py
----------------
All terminal rendering lives here.  Uses `rich` for coloured, structured output.
Every public function is side-effect-only (prints to stdout).
"""

from __future__ import annotations

from typing import Any

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich import print as rprint

console = Console(legacy_windows=False)

BRAND_COLOR = "bold cyan"
USER_COLOR = "bold green"
AGENT_COLOR = "bold magenta"
TOOL_COLOR = "bold yellow"
ERROR_COLOR = "bold red"
DIM = "dim"


# ── Session chrome ────────────────────────────────────────────────────────────

def print_banner() -> None:
    console.print("[bold cyan]✈  AI Travel Planner[/bold cyan]  [dim]|  Powered by Groq + Amadeus + OpenWeather[/dim]\n")
    console.print("  Type [bold]your travel request[/bold] and press Enter.")
    console.print("  Commands: [yellow]/trip[/yellow] · [yellow]/clear[/yellow] · [yellow]/help[/yellow] · [yellow]/quit[/yellow]\n")


def print_help() -> None:
    table = Table(box=box.SIMPLE, show_header=False, padding=(0, 2))
    table.add_column("cmd", style="yellow bold", no_wrap=True)
    table.add_column("desc", style="white")
    for cmd, desc in [
        ("/trip",  "Show current trip context (destination, dates, budget …)"),
        ("/clear", "Clear conversation history and start fresh"),
        ("/help",  "Show this help message"),
        ("/quit",  "Exit the planner"),
    ]:
        table.add_row(cmd, desc)
    console.print(Panel(table, title="Commands", border_style="dim", padding=(0, 1)))


def print_trip_context(ctx_dict: dict[str, Any]) -> None:
    """Render TripContext as a tidy table."""
    table = Table(box=None, show_header=False, padding=0)
    table.add_column("field", no_wrap=True, width=19)
    table.add_column("value", style="white")

    skip = {"selected_flight", "selected_hotel", "attractions", "budget_breakdown", "weather_summary"}
    for k, v in ctx_dict.items():
        if k in skip or v is None or v == [] or v == {}:
            continue
        label = k.replace("_", " ").title()
        table.add_row(label, str(v))

    panel = Panel(table, title="📋  Trip Context", border_style="cyan", box=box.SQUARE, padding=(0, 2), width=68)
    from rich.padding import Padding
    console.print(Padding(panel, (0, 0, 0, 2)))
    console.print()


# ── Chat turns ────────────────────────────────────────────────────────────────

def print_user_message(msg: str) -> None:
    """Echo user input (called before sending to API)."""
    # Usually already in terminal; this is a no-op in most flows
    pass


def print_agent_message(msg: str) -> None:
    rprint(f"\n[{AGENT_COLOR}]🤖  Planner:[/{AGENT_COLOR}] {msg}\n")


def print_tool_call(tool_name: str, args_preview: str) -> None:
    console.print(
        f"  [{TOOL_COLOR}]⚙  {tool_name}[/{TOOL_COLOR}]  [dim]{args_preview}[/dim]",
        soft_wrap=True
    )


def print_tool_result(tool_name: str, result: Any, fallback: bool = False) -> None:
    label = f"{'⚠' if fallback else '✓'}  {tool_name}"
    style = "yellow" if fallback else "green"
    console.print(f"  [{style}]{label}[/{style}]", highlight=False)


def print_error(msg: str) -> None:
    console.print(f"\n  [{ERROR_COLOR}]✗  {msg}[/{ERROR_COLOR}]\n")


def print_separator() -> None:
    console.print("─" * 64, style="dim")


# ── Structured result renderers ───────────────────────────────────────────────

def render_flights(offers: list[dict[str, Any]]) -> None:
    for i, offer in enumerate(offers, 1):
        legs_str = "  →  ".join(
            f"{l['from']} → {l['to']} ({l.get('dep','?')[:10]} {l.get('dep','')[-5:]})"
            f"  [{l.get('flight_no','?')}]"
            for l in offer.get("legs", [])
        )
        seats = f"  |  {offer['seats_left']} seats left" if offer.get("seats_left") else ""
        rprint(
            f"  [cyan]#{i}[/cyan]  [bold]{offer['currency']} {offer['total_price']:,.0f}[/bold]"
            f"  |  {legs_str}{seats}"
        )


def render_hotels(offers: list[dict[str, Any]]) -> None:
    for i, h in enumerate(offers, 1):
        rating_val = h.get("rating")
        stars_count = 0
        if rating_val:
            if isinstance(rating_val, (int, float)):
                stars_count = int(rating_val)
            else:
                import re
                match = re.search(r'\d+(\.\d+)?', str(rating_val))
                if match:
                    try:
                        stars_count = int(float(match.group(0)))
                    except ValueError:
                        pass
        stars = "★" * stars_count
        cancellable = "✓ free cancel" if h.get("cancellable") else ""
        line2 = (
            f"       {h.get('room_type','?')} · "
            f"{h.get('currency','INR')} {h.get('price_per_night',0):,.0f}/night  "
            f"(total {h.get('total_price',0):,.0f})  {cancellable}"
        ).rstrip()
        name = h.get('name', '?')
        rprint(
            f"  [cyan]#{i}[/cyan]  [bold]{name:<27}[/bold]  {stars}\n"
            f"{line2}"
        )


def render_weather(data: dict[str, Any]) -> None:
    city = data.get("city", "")
    country = data.get("country", "")
    console.print(f"\n  [bold cyan]Weather: {city}, {country}[/bold cyan]")
    for day in data.get("forecast", []):
        rprint(
            f"  {day['date']}  {day['emoji']}  {day['condition']:<8}"
            f"{day['temp_min_c']}°C – {day['temp_max_c']}°C  "
            f"💧{day['humidity_pct']}%  💨{day['wind_kmh']} km/h"
        )


def render_attractions(pois: list[dict[str, Any]]) -> None:
    for i, p in enumerate(pois, 1):
        tags = ", ".join(p.get("tags", []))
        rprint(
            f"  [cyan]{i}.[/cyan]  [bold]{p.get('name')}[/bold]"
            f"  [{p.get('category','?')}]"
            + (f"  — {tags}" if tags else "")
        )


def render_budget(breakdown: dict[str, Any]) -> None:
    console.print()
    table = Table(box=None, show_header=False, padding=0)
    table.add_column("item", no_wrap=True, width=20)
    table.add_column("val", style="white")

    currency = breakdown.pop("currency", "INR")
    per_person = breakdown.pop("per_person", None)

    for k, v in breakdown.items():
        key_lower = k.lower()
        if "contingency" in key_lower:
            label = "Contingency 10%"
        elif "over_budget" in key_lower:
            label = "⚠  Over Budget By"
        elif "under_budget" in key_lower:
            label = "✅  Under Budget By"
        elif k == "TOTAL":
            label = "TOTAL"
        else:
            label = k.replace("_", " ").title()
        
        style = "bold green" if label == "TOTAL" else ("yellow" if "⚠" in label else "")
        
        if isinstance(v, str):
            parts = v.split()
            if len(parts) == 2:
                val = f"{parts[0]} {float(parts[1].replace(',', '')):>8,.2f}"
            else:
                val = v
        else:
            val = f"{currency} {v:>8,.2f}"
            
        table.add_row(label, val, style=style)

    if per_person is not None:
        val = f"{currency} {per_person:>8,.2f}"
        table.add_row("Per Person", val, style="dim")

    panel = Panel(table, title="💰  Budget Breakdown", border_style="green", box=box.ROUNDED, padding=(0, 2), width=58)
    from rich.padding import Padding
    console.print(Padding(panel, (0, 0, 0, 2)))
