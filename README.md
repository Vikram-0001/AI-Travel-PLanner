# ✈  AI Travel Planner — Terminal CLI

A production-quality AI travel planning agent that runs entirely in your terminal.
Powered by **Groq LLM**, **Amadeus** (flights / hotels / attractions),
**OpenWeatherMap**, and **ExchangeRate.host**.

---

## File Structure

```
travel_planner/
├── agent.py                  ← Entry point — run this
├── requirements.txt
├── .env.example
├── README.md
│
├── core/
│   ├── __init__.py
│   ├── models.py             ← Pydantic v2 models (TripContext, Memory, …)
│   └── amadeus_auth.py       ← Amadeus OAuth2 token manager
│
├── tools/
│   ├── __init__.py
│   ├── flights.py            ← Amadeus Flight Offers Search
│   ├── hotels.py             ← Amadeus Hotel Offers Search
│   ├── weather.py            ← OpenWeatherMap 5-day forecast
│   ├── attractions.py        ← Amadeus Points of Interest
│   ├── budget.py             ← Budget calculator + currency FX + Haversine
│   └── registry.py           ← Tool JSON schemas + dispatcher
│
└── utils/
    ├── __init__.py
    ├── display.py            ← Rich terminal renderers
    ├── summariser.py         ← Sliding-window memory compression
    └── context_extractor.py  ← LLM-based trip-fact extraction
```

---

## Quick Setup

### 1. Clone / copy the project

```bash
git clone <repo>   # or copy the folder
cd travel_planner
```

### 2. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up API keys

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Key | Where to get it |
|-----|----------------|
| `GROQ_API_KEY` | https://console.groq.com → API Keys |
| `AMADEUS_CLIENT_ID` | https://developers.amadeus.com → My Apps |
| `AMADEUS_CLIENT_SECRET` | same App page |
| `OPENWEATHER_API_KEY` | https://openweathermap.org/api → Free tier |
| `EXCHANGERATE_API_KEY` | https://exchangerate.host → optional for free tier |

> **Amadeus test environment** is free and covers most routes.  
> Change `AMADEUS_BASE_URL` to `https://api.amadeus.com` for live production data.

### 5. Run the planner

```bash
python agent.py
```

---

## Example Terminal Session

```
✈  AI Travel Planner  |  Powered by Groq + Amadeus + OpenWeather

  Type your travel request and press Enter.
  Commands: /trip · /clear · /help · /quit

You: I want to go to Paris from Delhi in late March for a week, budget around $2000

────────────────────────────────────────────────────────────────
  ⚙  search_flights  {"origin":"DEL","destination":"CDG","departure_date":"2025-03-22","return_date":"2025-03-29","adults":1,"currency":"USD"}
  ✓  search_flights

  ✈  Flight Offers
  #1  USD 742  |  DEL → CDG (2025-03-22 08:30)  [AI101]
  #2  USD 810  |  DEL → CDG (2025-03-22 14:15)  [EK512]

  ⚙  search_hotels  {"city_code":"PAR","check_in":"2025-03-22","check_out":"2025-03-29","adults":1,"currency":"USD"}
  ✓  search_hotels

  🏨  Hotel Offers
  #1  Hôtel des Arts Montmartre  ★★★
       Standard · USD 89/night  (total 623)  ✓ free cancel
  #2  ibis Paris Centre          ★★★
       Double · USD 75/night  (total 525)

  ⚙  get_weather_forecast  {"city":"Paris","country_code":"FR","days":5}
  ✓  get_weather_forecast

  Weather: Paris, FR
  2025-03-22  ⛅  Clouds  8°C – 13°C  💧68%  💨12.3 km/h
  2025-03-23  🌧️  Rain    6°C – 11°C  💧80%  💨18.5 km/h
  2025-03-24  ☀️  Clear   9°C – 15°C  💧50%  💨10.1 km/h

  ⚙  search_attractions  {"city_code":"PAR","max_results":5}
  ✓  search_attractions

  🗺  Attractions
  1.  Eiffel Tower  [LANDMARK]
  2.  Louvre Museum  [MUSEUM]
  3.  Musée d'Orsay  [MUSEUM]
  4.  Notre-Dame Cathedral  [LANDMARK]
  5.  Montmartre & Sacré-Cœur  [LANDMARK]

  ⚙  calculate_budget  {"flight_cost":742,"hotel_cost_per_night":89,"nights":7,"daily_food_budget":55,"daily_transport_budget":15,"activity_budget":120,"num_travellers":1,"currency":"USD","total_budget":2000}
  ✓  calculate_budget

  ╭──────────────── 💰  Budget Breakdown ──────────────────╮
  │  Flights             USD   742.00                      │
  │  Hotel               USD   623.00                      │
  │  Food                USD   385.00                      │
  │  Local Transport     USD   105.00                      │
  │  Activities          USD   120.00                      │
  │  Contingency 10%     USD   197.50                      │
  │  TOTAL               USD 2,172.50                      │
  │  ⚠  Over Budget By   USD   172.50                      │
  │  Per Person          USD 2,172.50                      │
  ╰────────────────────────────────────────────────────────╯

🤖  Planner: Here's your Paris trip at a glance:

**Flights (DEL → CDG):** Best option is Air India AI101 at **$742**
departing 22 Mar.  Round-trip included.

**Hotel:** Hôtel des Arts Montmartre (★★★) at **$89/night** — free
cancellation available.

**Weather:** Expect cool spring weather (6–15°C). Pack a light jacket;
23 Mar looks rainy.

**Top 5 things to do:** Eiffel Tower, Louvre, Musée d'Orsay,
Notre-Dame, Montmartre stroll.

**Budget:** Total comes to ~$2,173 — slightly over your $2,000 target
by **$173**.  You can trim this by:
  • Choosing the ibis Paris hotel ($75/night) → saves $98
  • Reducing daily food budget to $40 → saves $105

**Next steps:**
  1. Confirm departure date and I'll lock in the best fare.
  2. Would you like 3- or 4-star hotel options?
  3. Want a day-by-day Paris itinerary?

You: /trip
  ┌──────────────────────── 📋  Trip Context ────────────────────────┐
  │  Origin             DEL                                          │
  │  Destination        CDG                                          │
  │  Departure Date     2025-03-22                                   │
  │  Return Date        2025-03-29                                   │
  │  Num Adults         1                                            │
  │  Budget Usd         2000.0                                       │
  │  Currency           USD                                          │
  └──────────────────────────────────────────────────────────────────┘

You: /quit
Goodbye!  Safe travels. ✈
```

---

## Slash Commands

| Command | Action |
|---------|--------|
| `/trip` | Show current structured trip context |
| `/clear` | Reset conversation and trip memory |
| `/help` | List available commands |
| `/quit` | Exit the planner |

---

## Configuration

Edit `.env` to tune behaviour:

```env
MEMORY_WINDOW=20      # messages before summarisation triggers
SUMMARY_KEEP=6        # messages preserved verbatim after summarisation
GROQ_MODEL=llama3-70b-8192   # or mixtral-8x7b-32768
```

---

## Architecture Overview

```
agent.py (REPL)
    │
    ├─► ConversationMemory  ← sliding-window + LLM summarisation
    ├─► TripContext         ← structured Pydantic state
    │
    ├─► Groq (LLM) ──────► tool_calls ──► registry.execute_tool()
    │                                         ├─ search_flights   (Amadeus)
    │                                         ├─ search_hotels    (Amadeus)
    │                                         ├─ get_weather      (OpenWeather)
    │                                         ├─ search_attractions (Amadeus)
    │                                         ├─ calculate_budget  (local)
    │                                         ├─ currency_convert  (ExchangeRate.host)
    │                                         └─ haversine_distance (local maths)
    │
    └─► context_extractor  ← keeps TripContext in sync after each turn
```

---

## Suggested Next Improvements

1. **Persistent sessions** — save/load `TripContext` + `ConversationMemory` as JSON files so users can resume planning.
2. **Flight seat-map / fare rules** — use `Amadeus /v1/shopping/seatmaps` for seat selection.
3. **Real-time flight status** — Amadeus `/v2/schedule/flights` for live departure info.
4. **Hotel photos** — add Amadeus hotel media API responses.
5. **Multi-city trips** — extend `TripContext` to support a list of legs rather than a single O&D pair.
6. **Export to PDF / Markdown** — dump the final plan to a file the user can share.
7. **Voice input** — integrate `whisper-1` via Groq's audio API.
8. **Visa & passport checker** — integrate Sherpa or VisaDB API.
9. **Rate limiting & retry** — exponential back-off for Amadeus and OpenWeather calls.
10. **Unit tests** — pytest suite with recorded VCR cassettes for API calls.
