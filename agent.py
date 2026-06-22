"""
agent.py
--------
The main agentic loop for the AI Travel Planner.

Flow per user turn
──────────────────
1. Add user message to memory
2. Maybe summarise if window is full
3. Build system prompt (injected with live trip context)
4. Call Groq with tools
5. If tool_calls in response → execute tools → append results → re-call Groq
6. Print final assistant message
7. Extract updated trip context asynchronously
8. Repeat

Run directly with:  python agent.py
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Optional

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

from dotenv import load_dotenv
from groq import Groq
from rich.console import Console
from rich.prompt import Prompt

from core.models import ConversationMemory, TripContext
from tools.registry import TOOL_SCHEMAS, execute_tool
from utils.display import (
    console,
    print_agent_message,
    print_banner,
    print_error,
    print_help,
    print_separator,
    print_tool_call,
    print_tool_result,
    print_trip_context,
    render_attractions,
    render_budget,
    render_flights,
    render_hotels,
    render_weather,
)
from utils.summariser import maybe_summarise
from utils.context_extractor import extract_trip_context

load_dotenv()


# ── System prompt factory ─────────────────────────────────────────────────────

def build_system_prompt(ctx: TripContext) -> str:
    missing = ctx.missing_essentials()
    missing_note = (
        f"\n⚠  Still missing: {', '.join(missing)}.  Ask for these concisely."
        if missing
        else "\n✅  All essential trip details are known.  Plan proactively."
    )

    return f"""You are an expert AI travel planner running in a terminal.
Your goal: help the user plan a complete, actionable trip — flights, hotels,
weather, attractions, and budget — through natural conversation.

CURRENT TRIP CONTEXT
--------------------
{ctx.summary_line()}
Origin       : {ctx.origin or '—'}
Destination  : {ctx.destination or '—'}
Departure    : {ctx.departure_date or '—'}
Return       : {ctx.return_date or '—'}
Travellers   : {ctx.num_adults} adult(s), {ctx.num_children} child(ren)
Budget       : {f"${ctx.budget_usd:,.0f} {ctx.currency}" if ctx.budget_usd else '—'}
Style        : {ctx.trip_style or '—'}
Interests    : {', '.join(ctx.interests) or '—'}
{missing_note}

BEHAVIOUR RULES
---------------
1. If critical info is missing, ask ONE concise question at a time.
2. If you have enough info, call tools immediately — don't ask for permission.
3. After tool results, synthesise them into a clean, terminal-friendly summary.
4. Use bullet points and short sections; avoid long prose walls.
5. When tools fail, explain the issue briefly and offer alternatives.
6. Always present prices in the user's preferred currency when possible.
7. Suggest practical next steps at the end of each planning response.
8. IATA codes: use them internally but show city names to the user.
"""


# ── Tool-call execution layer ─────────────────────────────────────────────────

def _render_tool_data(tool_name: str, data: Any) -> None:
    """Pretty-print structured tool data in the terminal."""
    if not data:
        return
    if tool_name == "search_flights":
        offers = data if isinstance(data, list) else data.get("estimated_offers", [])
        if offers:
            console.print("\n  [bold cyan]✈  Flight Offers[/bold cyan]")
            render_flights(offers)
    elif tool_name == "search_hotels":
        if isinstance(data, list) and data:
            console.print("\n  [bold cyan]🏨  Hotel Offers[/bold cyan]")
            render_hotels(data)
    elif tool_name == "get_weather_forecast":
        if isinstance(data, dict) and "forecast" in data:
            render_weather(data)
    elif tool_name == "search_attractions":
        if isinstance(data, list) and data:
            console.print("\n  [bold cyan]🗺  Attractions[/bold cyan]")
            render_attractions(data)
    elif tool_name == "calculate_budget":
        bd = data.get("breakdown") if isinstance(data, dict) else None
        if bd:
            render_budget(dict(bd))  # render_budget mutates, pass a copy
    elif tool_name == "currency_convert":
        if isinstance(data, dict):
            console.print(
                f"\n  [green]💱  {data['original_amount']} {data['from']} "
                f"= {data['converted_amount']} {data['to']}  "
                f"(rate: {data['rate']})[/green]"
            )
    elif tool_name == "haversine_distance":
        if isinstance(data, dict):
            console.print(
                f"\n  [green]📏  Distance: {data['km']} km  /  {data['miles']} miles[/green]"
            )


def process_tool_calls(
    tool_calls: list[Any],
    memory: ConversationMemory,
    trip_ctx: TripContext,
) -> None:
    """Execute each tool call, render results, and append to memory."""
    for tc in tool_calls:
        fn = tc.function
        tool_name = fn.name
        args_json = fn.arguments or "{}"

        # Echo tool invocation to terminal
        try:
            args_preview = json.dumps(json.loads(args_json), separators=(",", ":"))
        except Exception:
            args_preview = args_json
        print_tool_call(tool_name, args_preview)

        result = execute_tool(tool_name, args_json)

        # Print status line
        print_tool_result(tool_name, result.data, fallback=result.fallback_used)

        # Render structured data where applicable
        if result.data:
            _render_tool_data(tool_name, result.data)

        # Build content string for the tool-result message
        if result.success or result.data:
            content_dict: dict[str, Any] = {"result": result.data}
            if result.fallback_used and result.fallback_note:
                content_dict["note"] = result.fallback_note
        else:
            content_dict = {"error": result.error, "note": result.fallback_note}

        # Update trip context from tool results
        _update_ctx_from_tool(tool_name, result.data, trip_ctx)

        # Append tool result to memory
        memory.add(
            role="tool",
            content=json.dumps(content_dict),
            tool_call_id=tc.id,
            name=tool_name,
        )


def _update_ctx_from_tool(
    tool_name: str,
    data: Any,
    ctx: TripContext,
) -> None:
    """Persist selected tool results back into TripContext."""
    if not data:
        return
    if tool_name == "search_flights" and isinstance(data, list) and data:
        ctx.selected_flight = data[0]        # cheapest / first offer
    elif tool_name == "search_hotels" and isinstance(data, list) and data:
        ctx.selected_hotel = data[0]
    elif tool_name == "get_weather_forecast" and isinstance(data, dict):
        forecast = data.get("forecast", [])
        if forecast:
            ctx.weather_summary = ", ".join(
                f"{d['date']}: {d['emoji']}{d['condition']} {d['temp_min_c']}–{d['temp_max_c']}°C"
                for d in forecast[:3]
            )
    elif tool_name == "search_attractions" and isinstance(data, list):
        ctx.attractions = data
    elif tool_name == "calculate_budget" and isinstance(data, dict):
        ctx.budget_breakdown = data.get("breakdown")


# ── Groq completion wrapper ───────────────────────────────────────────────────

def chat_with_groq(
    client: Groq,
    model: str,
    memory: ConversationMemory,
    system_prompt: str,
) -> Any:
    """Send messages to Groq and return the completion object."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    messages.extend(memory.to_api_messages())

    return client.chat.completions.create(
        model=model,
        messages=messages,
        tools=TOOL_SCHEMAS,
        tool_choice="auto",
        max_tokens=1500,
        temperature=0.4,
    )


# ── Main agent turn ───────────────────────────────────────────────────────────

def run_agent_turn(
    user_input: str,
    memory: ConversationMemory,
    trip_ctx: TripContext,
    client: Groq,
    model: str,
) -> None:
    """Process one user turn end-to-end."""

    # 1. Record user message
    memory.add(role="user", content=user_input)

    # 2. Summarise if window is full
    summarised = maybe_summarise(memory, client, model)
    if summarised:
        console.print("  [dim]📝  Older context summarised to save space.[/dim]")

    # 3. Agentic loop: call Groq, execute tools, re-call until no more tool_calls
    max_rounds = 5   # safety cap on tool-calling rounds
    for round_num in range(max_rounds):
        system_prompt = build_system_prompt(trip_ctx)

        try:
            completion = chat_with_groq(client, model, memory, system_prompt)
        except Exception as exc:
            print_error(f"Groq API error: {exc}")
            return

        choice = completion.choices[0]
        msg = choice.message
        finish = choice.finish_reason

        # Append assistant turn to memory (content may be None if tool-only)
        assistant_content = msg.content or ""
        memory.add(role="assistant", content=assistant_content)

        # 4. Handle tool calls
        if finish == "tool_calls" and msg.tool_calls:
            process_tool_calls(msg.tool_calls, memory, trip_ctx)
            # Re-enter loop so Groq can synthesise the results
            continue

        # 5. Final text response
        if assistant_content:
            print_agent_message(assistant_content)

        # 6. Extract trip context from this exchange (best-effort, async-style)
        extract_trip_context(user_input, assistant_content, client, model, trip_ctx)

        break   # done with this turn
    else:
        # Exceeded max_rounds — print whatever we have
        console.print("  [yellow]⚠  Max tool-call rounds reached.[/yellow]")


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    # ── Validate environment ──────────────────────────────────────────────────
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        print("[ERROR] GROQ_API_KEY is not set.  Copy .env.example → .env and fill in keys.")
        sys.exit(1)

    model = os.getenv("GROQ_MODEL", "llama3-70b-8192")
    window_size = int(os.getenv("MEMORY_WINDOW", "20"))
    keep_after = int(os.getenv("SUMMARY_KEEP", "6"))

    client = Groq(api_key=groq_key)
    memory = ConversationMemory(window_size=window_size, keep_after_summary=keep_after)
    trip_ctx = TripContext()

    print_banner()

    # ── REPL ─────────────────────────────────────────────────────────────────
    while True:
        try:
            user_input = Prompt.ask("[bold green]You[/bold green]").strip()
        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Goodbye!  Safe travels. ✈[/dim]")
            break

        if not user_input:
            continue

        # ── Slash commands ────────────────────────────────────────────────────
        cmd = user_input.lower()

        if cmd in ("/quit", "/exit", "/q"):
            console.print("[dim]Goodbye!  Safe travels. ✈[/dim]")
            break

        if cmd == "/help":
            print_help()
            continue

        if cmd == "/clear":
            memory = ConversationMemory(window_size=window_size, keep_after_summary=keep_after)
            trip_ctx = TripContext()
            console.print("[dim]  Conversation and trip context cleared.[/dim]\n")
            continue

        if cmd == "/trip":
            print_trip_context(trip_ctx.model_dump())
            continue

        # ── Normal agent turn ─────────────────────────────────────────────────
        print_separator()
        run_agent_turn(user_input, memory, trip_ctx, client, model)


if __name__ == "__main__":
    main()
