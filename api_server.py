"""
api_server.py
-------------
Flask REST API that wraps the AI Travel Planner agent for the frontend.

Endpoints
---------
GET  /api/health              — liveness check
POST /api/chat                — single-turn chat (returns full response)
GET  /api/chat/stream         — streaming SSE chat
GET  /api/trip-context        — get current trip context for a session
POST /api/reset               — reset a session's memory and trip context

# Tool endpoints (all prices in INR by default)
POST /api/flights             — search flights via Serp API (Google Flights)
POST /api/hotels              — search hotels via Serp API (Google Hotels)
POST /api/weather             — 5-day weather forecast via OpenWeatherMap
POST /api/weather/current     — current weather via OpenWeatherMap
POST /api/attractions         — search attractions (Amadeus / curated fallback)
POST /api/budget              — calculate trip budget breakdown in INR
POST /api/currency/convert    — live currency conversion

Sessions are stored in-memory (keyed by session_id).
For production, replace with Redis or a database.

Run with:
    python api_server.py
or:
    flask --app api_server run --port 8000 --debug
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from typing import Any, Generator

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

load_dotenv()

# ── Validate required env vars ────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    print("[ERROR] GROQ_API_KEY is not set. Copy .env.example → .env and fill in the key.")
    sys.exit(1)

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama3-70b-8192").strip()
MEMORY_WINDOW = int(os.getenv("MEMORY_WINDOW", "20"))
SUMMARY_KEEP = int(os.getenv("SUMMARY_KEEP", "6"))

# ── Import agent modules ──────────────────────────────────────────────────────

try:
    from groq import Groq
    from core.models import ConversationMemory, TripContext
    from tools.registry import TOOL_SCHEMAS, execute_tool
    from tools.flights import search_flights
    from tools.hotels import search_hotels
    from tools.weather import get_weather_forecast, get_current_weather
    from tools.attractions import search_attractions
    from tools.budget import calculate_budget, currency_convert
    from utils.summariser import maybe_summarise
    from utils.context_extractor import extract_trip_context
    from agent import build_system_prompt, _update_ctx_from_tool
except ImportError as exc:
    print(f"[ERROR] Failed to import agent modules: {exc}")
    print("Make sure you are running from the project root directory.")
    sys.exit(1)

# ── Flask app setup ───────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ── In-memory session store ───────────────────────────────────────────────────
# Each session_id maps to {"memory": ConversationMemory, "trip_ctx": TripContext}

_sessions: dict[str, dict[str, Any]] = {}
_groq_client = Groq(api_key=GROQ_API_KEY)


def _get_session(session_id: str) -> dict[str, Any]:
    """Return an existing session or create a new one."""
    if session_id not in _sessions:
        _sessions[session_id] = {
            "memory": ConversationMemory(
                window_size=MEMORY_WINDOW,
                keep_after_summary=SUMMARY_KEEP,
            ),
            "trip_ctx": TripContext(),
        }
    return _sessions[session_id]


# ── Tool execution helper ─────────────────────────────────────────────────────

def _run_tool_calls(
    tool_calls: list[Any],
    memory: ConversationMemory,
    trip_ctx: TripContext,
) -> list[dict[str, Any]]:
    """Execute tool calls, update memory & trip context, return tool results."""
    results = []
    for tc in tool_calls:
        fn = tc.function
        tool_name = fn.name
        args_json = fn.arguments or "{}"

        result = execute_tool(tool_name, args_json)

        # Build content dict for memory
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

        results.append({
            "tool_name": tool_name,
            "success": result.success,
            "data": result.data,
            "error": result.error,
            "fallback_used": result.fallback_used,
        })

    return results


def _call_groq(memory: ConversationMemory, system_prompt: str) -> Any:
    """Call Groq and return the completion object."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    messages.extend(memory.to_api_messages())

    return _groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        tools=TOOL_SCHEMAS,
        tool_choice="auto",
        max_tokens=1500,
        temperature=0.4,
    )


# ── Agentic loop (non-streaming) ──────────────────────────────────────────────

def run_agent_turn_api(
    user_input: str,
    session_id: str,
) -> dict[str, Any]:
    """
    Process one user turn and return the assistant's final response as a dict.
    Returns: {"reply": str, "trip_context": dict, "tool_calls_made": list}
    """
    session = _get_session(session_id)
    memory: ConversationMemory = session["memory"]
    trip_ctx: TripContext = session["trip_ctx"]

    # Add user message to memory
    memory.add(role="user", content=user_input)

    # Summarise if window is full
    maybe_summarise(memory, _groq_client, GROQ_MODEL)

    tool_calls_log: list[dict[str, Any]] = []
    final_reply = ""

    max_rounds = 5
    for _ in range(max_rounds):
        system_prompt = build_system_prompt(trip_ctx)

        try:
            completion = _call_groq(memory, system_prompt)
        except Exception as exc:
            return {
                "reply": f"Sorry, I encountered an error talking to the AI service: {str(exc)}",
                "trip_context": trip_ctx.model_dump(mode="json"),
                "tool_calls_made": tool_calls_log,
                "error": str(exc),
            }

        choice = completion.choices[0]
        msg = choice.message
        finish = choice.finish_reason
        assistant_content = msg.content or ""

        # Append assistant message to memory
        memory.add(role="assistant", content=assistant_content)

        if finish == "tool_calls" and msg.tool_calls:
            results = _run_tool_calls(msg.tool_calls, memory, trip_ctx)
            tool_calls_log.extend(results)
            continue

        final_reply = assistant_content

        # Extract trip context from exchange (best-effort)
        try:
            extract_trip_context(user_input, assistant_content, _groq_client, GROQ_MODEL, trip_ctx)
        except Exception:
            pass

        break
    else:
        final_reply = final_reply or "I've processed your request but reached the tool-call limit. Please ask a follow-up question."

    return {
        "reply": final_reply,
        "trip_context": trip_ctx.model_dump(mode="json"),
        "tool_calls_made": tool_calls_log,
        "error": None,
    }


# ── Streaming agentic loop ────────────────────────────────────────────────────

def _stream_agent_turn(
    user_input: str,
    session_id: str,
) -> Generator[str, None, None]:
    """
    Generator that yields Server-Sent Events (SSE) for a streaming chat response.
    SSE format: data: <json>\n\n
    """

    def sse(event_type: str, payload: Any) -> str:
        return f"data: {json.dumps({'type': event_type, 'payload': payload})}\n\n"

    session = _get_session(session_id)
    memory: ConversationMemory = session["memory"]
    trip_ctx: TripContext = session["trip_ctx"]

    memory.add(role="user", content=user_input)
    maybe_summarise(memory, _groq_client, GROQ_MODEL)

    yield sse("status", {"message": "Thinking…"})

    tool_calls_log: list[dict[str, Any]] = []
    final_reply = ""

    max_rounds = 5
    for _ in range(max_rounds):
        system_prompt = build_system_prompt(trip_ctx)

        try:
            completion = _call_groq(memory, system_prompt)
        except Exception as exc:
            yield sse("error", {"message": str(exc)})
            return

        choice = completion.choices[0]
        msg = choice.message
        finish = choice.finish_reason
        assistant_content = msg.content or ""
        memory.add(role="assistant", content=assistant_content)

        if finish == "tool_calls" and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                yield sse("tool_start", {"tool": tool_name})

            results = _run_tool_calls(msg.tool_calls, memory, trip_ctx)
            tool_calls_log.extend(results)

            for r in results:
                yield sse("tool_result", r)

            yield sse("status", {"message": "Analysing results…"})
            continue

        final_reply = assistant_content

        try:
            extract_trip_context(user_input, assistant_content, _groq_client, GROQ_MODEL, trip_ctx)
        except Exception:
            pass

        break
    else:
        final_reply = final_reply or "I've processed your request but reached the tool-call limit. Please ask a follow-up question."

    yield sse("reply", {
        "content": final_reply,
        "trip_context": trip_ctx.model_dump(mode="json"),
        "tool_calls_made": tool_calls_log,
    })
    yield sse("done", {})


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    """Liveness probe. Returns 200 if the server and Groq key are ready."""
    return jsonify({
        "status": "ok",
        "model": GROQ_MODEL,
        "active_sessions": len(_sessions),
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Non-streaming chat endpoint.
    Body: { "message": str, "session_id": str (optional) }
    Response: { "reply": str, "session_id": str, "trip_context": dict, "error": str|null }
    """
    body = request.get_json(silent=True)
    if not body or not body.get("message"):
        return jsonify({"error": "Request body must include a 'message' field."}), 400

    user_message: str = str(body["message"]).strip()
    if not user_message:
        return jsonify({"error": "'message' must not be empty."}), 400

    session_id: str = body.get("session_id") or str(uuid.uuid4())

    result = run_agent_turn_api(user_message, session_id)
    result["session_id"] = session_id

    status_code = 500 if result.get("error") else 200
    return jsonify(result), status_code


@app.route("/api/chat/stream", methods=["GET"])
def chat_stream():
    """
    Streaming SSE chat endpoint.
    Query params: message=<str>, session_id=<str> (optional)
    """
    user_message = (request.args.get("message") or "").strip()
    if not user_message:
        return jsonify({"error": "'message' query param is required."}), 400

    session_id = request.args.get("session_id") or str(uuid.uuid4())

    def generate():
        # First event includes the session_id
        yield f"data: {json.dumps({'type': 'session', 'payload': {'session_id': session_id}})}\n\n"
        yield from _stream_agent_turn(user_message, session_id)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.route("/api/trip-context", methods=["GET"])
def trip_context():
    """
    Get the current trip context for a session.
    Query params: session_id=<str>
    """
    session_id = request.args.get("session_id", "")
    if not session_id or session_id not in _sessions:
        return jsonify({"error": "Session not found."}), 404

    ctx = _sessions[session_id]["trip_ctx"]
    return jsonify({"session_id": session_id, "trip_context": ctx.model_dump(mode="json")})


@app.route("/api/reset", methods=["POST"])
def reset_session():
    """
    Reset memory and trip context for a session.
    Body: { "session_id": str }
    """
    body = request.get_json(silent=True) or {}
    session_id = body.get("session_id", "")
    if session_id and session_id in _sessions:
        del _sessions[session_id]
    new_id = str(uuid.uuid4())
    _get_session(new_id)   # pre-create fresh session
    return jsonify({"session_id": new_id, "message": "Session reset successfully."})


# ── Tool REST endpoints ───────────────────────────────────────────────────────

@app.route("/api/flights", methods=["POST"])
def api_flights():
    """
    Search flights via Serp API (Google Flights). All prices returned in INR.
    Body: { origin, destination, departure_date, return_date?, adults?, children?, max_results?, currency? }
    """
    body = request.get_json(silent=True) or {}
    required = ["origin", "destination", "departure_date"]
    for field in required:
        if not body.get(field):
            return jsonify({"error": f"'{field}' is required."}), 400

    result = search_flights(
        origin=body["origin"],
        destination=body["destination"],
        departure_date=body["departure_date"],
        return_date=body.get("return_date"),
        adults=int(body.get("adults", 1)),
        children=int(body.get("children", 0)),
        max_results=int(body.get("max_results", 3)),
        currency=body.get("currency", "INR"),
    )

    if result.success and result.data:
        return jsonify({"data": result.data, "error": None})
    elif result.data:  # fallback data available
        return jsonify({"data": result.data, "error": result.error, "fallback": True})
    else:
        return jsonify({"data": [], "error": result.error or "No flights found.", "fallback": result.fallback_used}), 200


@app.route("/api/hotels", methods=["POST"])
def api_hotels():
    """
    Search hotels via Serp API (Google Hotels). All prices returned in INR.
    Body: { city_code, check_in, check_out, adults?, max_results?, currency?, ratings? }
    """
    body = request.get_json(silent=True) or {}
    required = ["city_code", "check_in", "check_out"]
    for field in required:
        if not body.get(field):
            return jsonify({"error": f"'{field}' is required."}), 400

    result = search_hotels(
        city_code=body["city_code"],
        check_in=body["check_in"],
        check_out=body["check_out"],
        adults=int(body.get("adults", 1)),
        max_results=int(body.get("max_results", 3)),
        currency=body.get("currency", "INR"),
        ratings=body.get("ratings"),
    )

    if result.success and result.data:
        return jsonify({"data": result.data, "error": None})
    elif result.data:
        return jsonify({"data": result.data, "error": result.error, "fallback": True})
    else:
        return jsonify({"data": [], "error": result.error or "No hotels found.", "fallback": result.fallback_used}), 200


@app.route("/api/weather", methods=["POST"])
def api_weather():
    """
    Get 5-day weather forecast via OpenWeatherMap.
    Body: { city, country_code?, days? }
    """
    body = request.get_json(silent=True) or {}
    if not body.get("city"):
        return jsonify({"error": "'city' is required."}), 400

    result = get_weather_forecast(
        city=body["city"],
        country_code=body.get("country_code", ""),
        days=int(body.get("days", 5)),
    )

    if result.success and result.data:
        return jsonify({"data": result.data, "error": None})
    else:
        return jsonify({"data": None, "error": result.error or "Weather data unavailable."}), 200


@app.route("/api/weather/current", methods=["POST"])
def api_weather_current():
    """
    Get current weather via OpenWeatherMap.
    Body: { city, country_code? }
    """
    body = request.get_json(silent=True) or {}
    if not body.get("city"):
        return jsonify({"error": "'city' is required."}), 400

    result = get_current_weather(
        city=body["city"],
        country_code=body.get("country_code", ""),
    )

    if result.success and result.data:
        return jsonify({"data": result.data, "error": None})
    else:
        return jsonify({"data": None, "error": result.error or "Current weather unavailable."}), 200


@app.route("/api/attractions", methods=["POST"])
def api_attractions():
    """
    Search attractions. Falls back to curated list when API is unavailable.
    Body: { latitude?, longitude?, city_code?, radius_km?, categories?, max_results? }
    """
    body = request.get_json(silent=True) or {}

    result = search_attractions(
        latitude=body.get("latitude"),
        longitude=body.get("longitude"),
        city_code=body.get("city_code"),
        radius_km=int(body.get("radius_km", 5)),
        categories=body.get("categories"),
        max_results=int(body.get("max_results", 8)),
    )

    if result.success and result.data:
        return jsonify({"data": result.data, "error": None, "fallback": result.fallback_used})
    else:
        return jsonify({"data": [], "error": result.error or "No attractions found."}), 200


@app.route("/api/budget", methods=["POST"])
def api_budget():
    """
    Calculate trip budget breakdown entirely in INR.
    Body: { flight_cost?, hotel_cost_per_night?, nights?, daily_food_budget?,
            daily_transport_budget?, activity_budget?, num_travellers?,
            currency?, total_budget? }
    Note: budget is the TOTAL amount available; expenses are broken down within it.
    """
    body = request.get_json(silent=True) or {}

    result = calculate_budget(
        flight_cost=body.get("flight_cost"),
        hotel_cost_per_night=body.get("hotel_cost_per_night"),
        nights=int(body.get("nights", 0)),
        daily_food_budget=float(body.get("daily_food_budget", 4000.0)),
        daily_transport_budget=float(body.get("daily_transport_budget", 1500.0)),
        activity_budget=float(body.get("activity_budget", 8000.0)),
        num_travellers=int(body.get("num_travellers", 1)),
        currency=body.get("currency", "INR"),
        total_budget=body.get("total_budget"),
    )

    if result.success:
        return jsonify({"data": result.data, "error": None})
    else:
        return jsonify({"data": None, "error": result.error or "Budget calculation failed."}), 500


@app.route("/api/currency/convert", methods=["POST"])
def api_currency_convert():
    """
    Convert currency using live rates.
    Body: { amount, from_currency, to_currency }
    """
    body = request.get_json(silent=True) or {}
    required = ["amount", "from_currency", "to_currency"]
    for field in required:
        if body.get(field) is None:
            return jsonify({"error": f"'{field}' is required."}), 400

    result = currency_convert(
        amount=float(body["amount"]),
        from_currency=body["from_currency"],
        to_currency=body["to_currency"],
    )

    if result.success:
        return jsonify({"data": result.data, "error": None})
    else:
        return jsonify({"data": None, "error": result.error or "Conversion failed."}), 500


# ── Error handlers ────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found."}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed."}), 405


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error.", "detail": str(e)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("API_PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    print(f"🚀  AI Travel Planner API starting on http://localhost:{port}")
    print(f"   Model : {GROQ_MODEL}")
    print(f"   Debug : {debug}")
    app.run(host="0.0.0.0", port=port, debug=debug)
