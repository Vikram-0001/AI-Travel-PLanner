// ── Types matching backend core/models.py exactly ────────────────────────────

export interface TripContext {
  origin: string | null;
  destination: string | null;
  departure_date: string | null; // YYYY-MM-DD
  return_date: string | null;
  num_adults: number;
  num_children: number;
  budget_usd: number | null;
  currency: string;
  trip_style: string | null;
  accommodation_type: string | null;
  interests: string[];
  special_requirements: string[];
  // Cached results
  selected_flight: FlightOffer | null;
  selected_hotel: HotelOffer | null;
  weather_summary: string | null;
  attractions: Attraction[];
  budget_breakdown: BudgetBreakdown | null;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  error: string | null;
  fallback_used: boolean;
  fallback_note: string | null;
}

// ── Flight types (tools/flights.py) ──────────────────────────────────────────

export interface FlightLeg {
  from: string;
  to: string;
  dep: string;
  arr: string;
  carrier: string;
  flight_no: string;
  duration: number;
  stops: number;
}

export interface FlightOffer {
  id: string;
  total_price: number;
  currency: string;
  seats_left: number | null;
  legs: FlightLeg[];
}

// ── Hotel types (tools/hotels.py) ────────────────────────────────────────────

export interface HotelOffer {
  hotel_id: string;
  name: string;
  rating: string;
  latitude: number | null;
  longitude: number | null;
  check_in: string;
  check_out: string;
  room_type: string;
  beds: string | null;
  price_per_night: number;
  total_price: number;
  currency: string;
  cancellable: boolean;
}

// ── Weather types (tools/weather.py) ─────────────────────────────────────────

export interface WeatherDay {
  date: string;
  condition: string;
  emoji: string;
  temp_min_c: number;
  temp_max_c: number;
  feels_like_c: number;
  humidity_pct: number;
  wind_kmh: number;
  description: string;
}

export interface CurrentWeather {
  condition: string;
  emoji: string;
  temp_c: number;
  feels_like_c: number;
  humidity_pct: number;
  wind_kmh: number;
  description: string;
  pressure_hpa?: number;
  visibility_km?: number;
  cloudiness_pct?: number;
}

export interface WeatherData {
  city: string;
  country: string;
  forecast?: WeatherDay[];
  condition?: string;
  emoji?: string;
  temp_c?: number;
  feels_like_c?: number;
  humidity_pct?: number;
  wind_kmh?: number;
  description?: string;
  pressure_hpa?: number;
  visibility_km?: number;
  cloudiness_pct?: number;
}

// ── Attraction types (tools/attractions.py) ──────────────────────────────────

export interface Attraction {
  name: string;
  category: string;
  subcategories?: string[];
  rank: number | null;
  tags?: string[];
  latitude?: number | null;
  longitude?: number | null;
}

// ── Budget types (tools/budget.py) ───────────────────────────────────────────

export interface BudgetBreakdown {
  flights?: number;
  hotel?: number;
  food: number;
  local_transport: number;
  activities: number;
  contingency_10pct: number;
  TOTAL: number;
  currency: string;
  per_person: number;
  over_budget_by?: string;
  under_budget_by?: string;
}

export interface BudgetResult {
  breakdown: BudgetBreakdown;
  over_budget: number | null;
}

// ── Currency types (tools/budget.py) ─────────────────────────────────────────

export interface CurrencyConversion {
  original_amount: number;
  from: string;
  to: string;
  rate: number;
  converted_amount: number;
}

// ── Distance types (tools/budget.py) ─────────────────────────────────────────

export interface HaversineDistance {
  km: number;
  miles: number;
}

// ── Auth / User types (frontend-only, no backend auth exists) ────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
  created_at: string;
}

export interface UserPreferences {
  default_currency: string;
  default_origin: string;
  trip_style: string;
  notifications: boolean;
}

// ── Trip (frontend model — saved trips) ──────────────────────────────────────

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  context: TripContext;
  status: 'planning' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tool_results?: ToolDisplayData[];
}

export interface ToolDisplayData {
  tool_name: string;
  data: unknown;
  success: boolean;
}

// ── API request types ────────────────────────────────────────────────────────

export interface SearchFlightsParams {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  adults?: number;
  children?: number;
  max_results?: number;
  currency?: string;
}

export interface SearchHotelsParams {
  city_code: string;
  check_in: string;
  check_out: string;
  adults?: number;
  max_results?: number;
  currency?: string;
  ratings?: number[];
}

export interface GetWeatherParams {
  city: string;
  country_code?: string;
  days?: number;
}

export interface GetCurrentWeatherParams {
  city: string;
  country_code?: string;
}

export interface SearchAttractionsParams {
  latitude?: number;
  longitude?: number;
  city_code?: string;
  radius_km?: number;
  categories?: string[];
  max_results?: number;
}

export interface CalculateBudgetParams {
  flight_cost?: number;
  hotel_cost_per_night?: number;
  nights?: number;
  daily_food_budget?: number;
  daily_transport_budget?: number;
  activity_budget?: number;
  num_travellers?: number;
  currency?: string;
  total_budget?: number;
}

export interface CurrencyConvertParams {
  amount: number;
  from_currency: string;
  to_currency: string;
}
