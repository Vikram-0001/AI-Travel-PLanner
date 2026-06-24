/**
 * api/services.ts
 * ---------------
 * Service layer that talks to the Flask backend (api_server.py).
 *
 * Chat:       real calls to /api/chat  (POST)  and /api/chat/stream (SSE)
 * Auth/Trips: local mock (no DB backend) — replace with real endpoints when ready.
 */

import apiClient, { API_BASE_URL } from './client';
import type {
  SearchFlightsParams,
  SearchHotelsParams,
  GetWeatherParams,
  GetCurrentWeatherParams,
  SearchAttractionsParams,
  CalculateBudgetParams,
  CurrencyConvertParams,
  FlightOffer,
  HotelOffer,
  WeatherData,
  Attraction,
  BudgetResult,
  CurrencyConversion,
  HaversineDistance,
  Trip,
  User,
} from '@/types';
import {
  mockUser,
  mockTrips,
  mockDistance,
} from '@/utils/mockData';

// Simulate network delay (used only by mock services)
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => delay(400 + Math.random() * 600);

// ── Session management ────────────────────────────────────────────────────────

const SESSION_KEY = 'travel_session_id';

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function clearSessionId(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<{
  ok: boolean;
  model?: string;
  error?: string;
}> {
  try {
    const res = await apiClient.get<{ status: string; model: string }>('/api/health');
    return { ok: res.data.status === 'ok', model: res.data.model };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: msg };
  }
}

// ── Chat (real backend) ───────────────────────────────────────────────────────

export interface ChatResponse {
  reply: string;
  session_id: string;
  trip_context: Record<string, unknown>;
  tool_calls_made: Array<{ tool_name: string; success: boolean }>;
  error: string | null;
}

/**
 * Send a message to the AI and get a complete response.
 * Throws on network errors; the `error` field covers AI-side errors.
 */
export async function sendChatMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const sid = sessionId || getSessionId();
  const res = await apiClient.post<ChatResponse>('/api/chat', {
    message,
    session_id: sid,
  });
  // Persist backend-assigned session id
  if (res.data.session_id) {
    sessionStorage.setItem(SESSION_KEY, res.data.session_id);
  }
  return res.data;
}

// ── Streaming chat (Server-Sent Events) ───────────────────────────────────────

export interface StreamEvent {
  type: 'session' | 'status' | 'tool_start' | 'tool_result' | 'reply' | 'done' | 'error';
  payload: Record<string, unknown>;
}

/**
 * Open a streaming SSE connection to /api/chat/stream.
 * Calls onEvent for every SSE event, onError on failure, onDone when finished.
 * Returns a cleanup function that closes the EventSource.
 */
export function streamChatMessage(
  message: string,
  sessionId: string | undefined,
  onEvent: (event: StreamEvent) => void,
  onError: (err: string) => void,
  onDone: () => void
): () => void {
  const sid = sessionId || getSessionId();
  const params = new URLSearchParams({ message, session_id: sid });
  const url = `${API_BASE_URL}/api/chat/stream?${params.toString()}`;

  const source = new EventSource(url);

  source.onmessage = (e: MessageEvent) => {
    try {
      const event: StreamEvent = JSON.parse(e.data);

      // Persist session id from backend
      if (event.type === 'session' && event.payload.session_id) {
        sessionStorage.setItem(SESSION_KEY, event.payload.session_id as string);
      }

      onEvent(event);

      if (event.type === 'done') {
        source.close();
        onDone();
      }
      if (event.type === 'error') {
        source.close();
        onError((event.payload.message as string) || 'Unknown streaming error');
      }
    } catch {
      // Ignore parse errors for keep-alive pings
    }
  };

  source.onerror = () => {
    source.close();
    onError('Streaming connection lost. Please try again.');
  };

  // Return cleanup
  return () => source.close();
}

// ── Trip context ──────────────────────────────────────────────────────────────

export async function fetchTripContext(sessionId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await apiClient.get<{ trip_context: Record<string, unknown> }>(
      `/api/trip-context?session_id=${encodeURIComponent(sessionId)}`
    );
    return res.data.trip_context;
  } catch {
    return null;
  }
}

// ── Reset session ─────────────────────────────────────────────────────────────

export async function resetSession(): Promise<string> {
  const res = await apiClient.post<{ session_id: string }>('/api/reset', {
    session_id: getSessionId(),
  });
  const newId = res.data.session_id;
  sessionStorage.setItem(SESSION_KEY, newId);
  return newId;
}

// ── Flights (real call to /api/flights) ─────────────────────────────────────

export async function searchFlights(params: SearchFlightsParams): Promise<FlightOffer[]> {
  try {
    const res = await apiClient.post<{ data: FlightOffer[]; error: string | null }>('/api/flights', {
      ...params,
      currency: params.currency || 'INR',
    });
    if (res.data.data && Array.isArray(res.data.data)) {
      // Handle nested estimated_offers from fallback
      const raw = res.data.data as unknown as FlightOffer[] | { estimated_offers?: FlightOffer[] };
      if (!Array.isArray(raw) && raw.estimated_offers) {
        return raw.estimated_offers;
      }
      return res.data.data;
    }
    return [];
  } catch {
    return [];
  }
}

// ── Hotels (real call to /api/hotels) ───────────────────────────────────────

export async function searchHotels(params: SearchHotelsParams): Promise<HotelOffer[]> {
  try {
    const res = await apiClient.post<{ data: HotelOffer[]; error: string | null }>('/api/hotels', {
      ...params,
      currency: params.currency || 'INR',
    });
    return res.data.data || [];
  } catch {
    return [];
  }
}

// ── Weather forecast (real call to /api/weather) ──────────────────────────

export async function getWeather(params: GetWeatherParams): Promise<WeatherData> {
  try {
    const res = await apiClient.post<{ data: WeatherData; error: string | null }>('/api/weather', params);
    if (res.data.data) return res.data.data;
    throw new Error(res.data.error || 'Weather unavailable');
  } catch {
    // Return minimal structure so UI doesn't crash
    return { city: params.city, country: params.country_code || '', forecast: [] };
  }
}

// ── Current Weather (real call to /api/weather/current) ────────────────────

export async function getCurrentWeather(params: GetCurrentWeatherParams): Promise<WeatherData> {
  try {
    const res = await apiClient.post<{ data: WeatherData; error: string | null }>('/api/weather/current', params);
    if (res.data.data) return res.data.data;
    throw new Error(res.data.error || 'Current weather unavailable');
  } catch {
    return { city: params.city, country: params.country_code || '' };
  }
}

// ── Attractions (real call to /api/attractions) ────────────────────────────

export async function searchAttractions(params: SearchAttractionsParams): Promise<Attraction[]> {
  try {
    const res = await apiClient.post<{ data: Attraction[]; error: string | null }>('/api/attractions', params);
    return res.data.data || [];
  } catch {
    return [];
  }
}

// ── Budget (real call to /api/budget — all amounts in INR) ────────────────────

export async function calculateBudget(params: CalculateBudgetParams): Promise<BudgetResult> {
  try {
    const res = await apiClient.post<{ data: BudgetResult; error: string | null }>('/api/budget', {
      ...params,
      currency: params.currency || 'INR',
      // INR-appropriate defaults if not provided
      daily_food_budget: params.daily_food_budget ?? 4000,
      daily_transport_budget: params.daily_transport_budget ?? 1500,
      activity_budget: params.activity_budget ?? 8000,
    });
    if (res.data.data) return res.data.data;
    throw new Error(res.data.error || 'Budget calculation failed');
  } catch {
    // Client-side fallback calculation in INR
    const flightCost = params.flight_cost || 0;
    const hotelPerNight = params.hotel_cost_per_night || 0;
    const nights = params.nights || 0;
    const food = (params.daily_food_budget ?? 4000) * nights * (params.num_travellers || 1);
    const transport = (params.daily_transport_budget ?? 1500) * nights * (params.num_travellers || 1);
    const activities = params.activity_budget ?? 8000;
    const hotelTotal = hotelPerNight * nights;
    const subtotal = flightCost + hotelTotal + food + transport + activities;
    const contingency = Math.round(subtotal * 0.1 * 100) / 100;
    const total = Math.round((subtotal + contingency) * 100) / 100;
    const budget = params.total_budget;
    const overBudget = budget ? (total > budget ? Math.round((total - budget) * 100) / 100 : null) : null;
    return {
      breakdown: {
        flights: flightCost || undefined,
        hotel: hotelTotal || undefined,
        food: Math.round(food * 100) / 100,
        local_transport: Math.round(transport * 100) / 100,
        activities: Math.round(activities * 100) / 100,
        contingency_10pct: contingency,
        TOTAL: total,
        currency: params.currency || 'INR',
        per_person: Math.round((total / (params.num_travellers || 1)) * 100) / 100,
      },
      over_budget: overBudget,
    };
  }
}

// ── Currency (real call to /api/currency/convert) ───────────────────────────

export async function convertCurrency(params: CurrencyConvertParams): Promise<CurrencyConversion> {
  try {
    const res = await apiClient.post<{ data: CurrencyConversion; error: string | null }>('/api/currency/convert', params);
    if (res.data.data) return res.data.data;
    throw new Error(res.data.error || 'Conversion failed');
  } catch {
    // Static fallback rates (INR base)
    const INR_RATES: Record<string, number> = {
      USD: 0.012, EUR: 0.011, GBP: 0.0095, INR: 1.0,
      JPY: 1.79, AUD: 0.0184, CAD: 0.0163, SGD: 0.016,
      AED: 0.044, THB: 0.43,
    };
    const toRate = INR_RATES[params.to_currency.toUpperCase()] || 1;
    const fromRate = INR_RATES[params.from_currency.toUpperCase()] || 1;
    const rate = toRate / fromRate;
    return {
      original_amount: params.amount,
      from: params.from_currency,
      to: params.to_currency,
      rate: Math.round(rate * 1000000) / 1000000,
      converted_amount: Math.round(params.amount * rate * 100) / 100,
    };
  }
}

// ── Distance (matches tools/budget.py haversine_distance) ────────────────────

export async function getDistance(
  _lat1: number,
  _lon1: number,
  _lat2: number,
  _lon2: number
): Promise<HaversineDistance> {
  await randomDelay();
  return mockDistance;
}

// ── Auth (frontend-only mock — replace with real endpoint when DB is added) ───

export async function login(email: string, _password: string): Promise<{ user: User; token: string }> {
  await randomDelay();
  if (email && _password.length >= 6) {
    return { user: mockUser, token: 'mock-jwt-token-' + Date.now() };
  }
  throw new Error('Invalid credentials');
}

export async function signup(
  name: string,
  email: string,
  _password: string
): Promise<{ user: User; token: string }> {
  await randomDelay();
  return {
    user: { ...mockUser, name, email },
    token: 'mock-jwt-token-' + Date.now(),
  };
}

// ── Trips (localStorage-backed mock — replace with real endpoint when ready) ──

const TRIPS_KEY = 'travel_trips';

function getStoredTrips(): Trip[] {
  try {
    const stored = localStorage.getItem(TRIPS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  localStorage.setItem(TRIPS_KEY, JSON.stringify(mockTrips));
  return mockTrips;
}

function saveTrips(trips: Trip[]): void {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

export async function getTrips(): Promise<Trip[]> {
  await delay(300);
  return getStoredTrips();
}

export async function getTrip(id: string): Promise<Trip | null> {
  await delay(200);
  return getStoredTrips().find((t) => t.id === id) || null;
}

export async function createTrip(trip: Omit<Trip, 'id' | 'created_at' | 'updated_at'>): Promise<Trip> {
  await delay(400);
  const trips = getStoredTrips();
  const newTrip: Trip = {
    ...trip,
    id: `trip-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  trips.unshift(newTrip);
  saveTrips(trips);
  return newTrip;
}

export async function updateTrip(id: string, updates: Partial<Trip>): Promise<Trip> {
  await delay(300);
  const trips = getStoredTrips();
  const idx = trips.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Trip not found');
  trips[idx] = { ...trips[idx], ...updates, updated_at: new Date().toISOString() };
  saveTrips(trips);
  return trips[idx];
}

export async function deleteTrip(id: string): Promise<void> {
  await delay(300);
  saveTrips(getStoredTrips().filter((t) => t.id !== id));
}

// ── User profile (localStorage-backed mock) ───────────────────────────────────

export async function getUserProfile(): Promise<User> {
  await delay(200);
  const stored = localStorage.getItem('user_profile');
  if (stored) return JSON.parse(stored);
  localStorage.setItem('user_profile', JSON.stringify(mockUser));
  return mockUser;
}

export async function updateUserProfile(updates: Partial<User>): Promise<User> {
  await delay(300);
  const current = await getUserProfile();
  const updated = { ...current, ...updates };
  localStorage.setItem('user_profile', JSON.stringify(updated));
  return updated;
}
