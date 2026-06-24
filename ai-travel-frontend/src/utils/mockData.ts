import type {
  FlightOffer,
  HotelOffer,
  WeatherData,
  Attraction,
  BudgetResult,
  CurrencyConversion,
  HaversineDistance,
  Trip,
  User,
  ChatMessage,
} from '@/types';

// ── Mock flights matching tools/flights.py _parse_offer output ───────────────

export const mockFlights: FlightOffer[] = [
  {
    id: 'flt-001',
    total_price: 742,
    currency: 'USD',
    seats_left: 4,
    legs: [
      {
        from: 'DEL',
        to: 'CDG',
        dep: '2025-03-22 08:30',
        arr: '2025-03-22 14:45',
        carrier: 'Air India',
        flight_no: 'AI101',
        duration: 555,
        stops: 0,
      },
    ],
  },
  {
    id: 'flt-002',
    total_price: 810,
    currency: 'USD',
    seats_left: 7,
    legs: [
      {
        from: 'DEL',
        to: 'DXB',
        dep: '2025-03-22 14:15',
        arr: '2025-03-22 16:30',
        carrier: 'Emirates',
        flight_no: 'EK512',
        duration: 135,
        stops: 1,
      },
      {
        from: 'DXB',
        to: 'CDG',
        dep: '2025-03-22 18:00',
        arr: '2025-03-22 22:30',
        carrier: 'Emirates',
        flight_no: 'EK739',
        duration: 330,
        stops: 0,
      },
    ],
  },
  {
    id: 'flt-003',
    total_price: 685,
    currency: 'USD',
    seats_left: 2,
    legs: [
      {
        from: 'DEL',
        to: 'IST',
        dep: '2025-03-22 03:00',
        arr: '2025-03-22 07:15',
        carrier: 'Turkish Airlines',
        flight_no: 'TK717',
        duration: 315,
        stops: 1,
      },
      {
        from: 'IST',
        to: 'CDG',
        dep: '2025-03-22 09:30',
        arr: '2025-03-22 12:45',
        carrier: 'Turkish Airlines',
        flight_no: 'TK1825',
        duration: 195,
        stops: 0,
      },
    ],
  },
];

// ── Mock hotels matching tools/hotels.py _parse_hotel_offer output ───────────

export const mockHotels: HotelOffer[] = [
  {
    hotel_id: 'hotel_hotel_des_arts',
    name: 'Hotel des Arts Montmartre',
    rating: '3',
    latitude: 48.8867,
    longitude: 2.3404,
    check_in: '2025-03-22',
    check_out: '2025-03-29',
    room_type: 'Standard',
    beds: '1 Queen',
    price_per_night: 89,
    total_price: 623,
    currency: 'USD',
    cancellable: true,
  },
  {
    hotel_id: 'hotel_ibis_paris',
    name: 'ibis Paris Centre',
    rating: '3',
    latitude: 48.8738,
    longitude: 2.3495,
    check_in: '2025-03-22',
    check_out: '2025-03-29',
    room_type: 'Double',
    beds: '1 Double',
    price_per_night: 75,
    total_price: 525,
    currency: 'USD',
    cancellable: false,
  },
  {
    hotel_id: 'hotel_le_brisetout',
    name: 'Le Brise Tout',
    rating: '4',
    latitude: 48.8606,
    longitude: 2.3376,
    check_in: '2025-03-22',
    check_out: '2025-03-29',
    room_type: 'Superior',
    beds: '1 King',
    price_per_night: 145,
    total_price: 1015,
    currency: 'USD',
    cancellable: true,
  },
];

// ── Mock weather matching tools/weather.py output ────────────────────────────

export const mockWeather: WeatherData = {
  city: 'Paris',
  country: 'FR',
  forecast: [
    {
      date: '2025-03-22',
      condition: 'Clouds',
      emoji: '⛅',
      temp_min_c: 8,
      temp_max_c: 13,
      feels_like_c: 10.5,
      humidity_pct: 68,
      wind_kmh: 12.3,
      description: 'Broken Clouds',
    },
    {
      date: '2025-03-23',
      condition: 'Rain',
      emoji: '🌧️',
      temp_min_c: 6,
      temp_max_c: 11,
      feels_like_c: 8.2,
      humidity_pct: 80,
      wind_kmh: 18.5,
      description: 'Light Rain',
    },
    {
      date: '2025-03-24',
      condition: 'Clear',
      emoji: '☀️',
      temp_min_c: 9,
      temp_max_c: 15,
      feels_like_c: 12.1,
      humidity_pct: 50,
      wind_kmh: 10.1,
      description: 'Clear Sky',
    },
    {
      date: '2025-03-25',
      condition: 'Clouds',
      emoji: '⛅',
      temp_min_c: 7,
      temp_max_c: 14,
      feels_like_c: 10.8,
      humidity_pct: 62,
      wind_kmh: 14.2,
      description: 'Scattered Clouds',
    },
    {
      date: '2025-03-26',
      condition: 'Clear',
      emoji: '☀️',
      temp_min_c: 10,
      temp_max_c: 16,
      feels_like_c: 13.0,
      humidity_pct: 45,
      wind_kmh: 8.7,
      description: 'Sunny',
    },
  ],
};

// ── Mock attractions matching tools/attractions.py output ────────────────────

export const mockAttractions: Attraction[] = [
  { name: 'Eiffel Tower', category: 'LANDMARK', rank: 1, tags: ['iconic', 'views', 'photography'], latitude: 48.8584, longitude: 2.2945 },
  { name: 'Louvre Museum', category: 'MUSEUM', rank: 2, tags: ['art', 'history', 'culture'], latitude: 48.8606, longitude: 2.3376 },
  { name: "Musee d'Orsay", category: 'MUSEUM', rank: 3, tags: ['art', 'impressionism'], latitude: 48.8600, longitude: 2.3266 },
  { name: 'Notre-Dame Cathedral', category: 'LANDMARK', rank: 4, tags: ['gothic', 'history', 'architecture'], latitude: 48.8530, longitude: 2.3499 },
  { name: 'Montmartre & Sacre-Coeur', category: 'LANDMARK', rank: 5, tags: ['neighborhood', 'views', 'art'], latitude: 48.8867, longitude: 2.3431 },
  { name: 'Musee de l\'Orangerie', category: 'MUSEUM', rank: 6, tags: ['art', 'monet'], latitude: 48.8639, longitude: 2.3225 },
  { name: 'Sainte-Chapelle', category: 'LANDMARK', rank: 7, tags: ['gothic', 'stained glass'], latitude: 48.8554, longitude: 2.3450 },
  { name: 'Luxembourg Gardens', category: 'PARK', rank: 8, tags: ['gardens', 'relaxation'], latitude: 48.8462, longitude: 2.3372 },
];

// ── Mock budget matching tools/budget.py calculate_budget output ─────────────

export const mockBudget: BudgetResult = {
  breakdown: {
    flights: 742,
    hotel: 623,
    food: 385,
    local_transport: 105,
    activities: 120,
    contingency_10pct: 197.5,
    TOTAL: 2172.5,
    currency: 'USD',
    per_person: 2172.5,
  },
  over_budget: 172.5,
};

// ── Mock currency conversion ─────────────────────────────────────────────────

export const mockCurrencyConversion: CurrencyConversion = {
  original_amount: 1000,
  from: 'USD',
  to: 'EUR',
  rate: 0.92,
  converted_amount: 920,
};

// ── Mock distance ────────────────────────────────────────────────────────────

export const mockDistance: HaversineDistance = {
  km: 5854.12,
  miles: 3637.68,
};

// ── Mock user ────────────────────────────────────────────────────────────────

export const mockUser: User = {
  id: 'usr-001',
  email: 'demo@travelplanner.com',
  name: 'Alex Johnson',
  avatar: '',
  preferences: {
    default_currency: 'USD',
    default_origin: 'DEL',
    trip_style: 'balanced',
    notifications: true,
  },
  created_at: '2025-01-15T10:00:00Z',
};

// ── Mock trips ───────────────────────────────────────────────────────────────

export const mockTrips: Trip[] = [
  {
    id: 'trip-001',
    user_id: 'usr-001',
    name: 'Paris Spring Getaway',
    context: {
      origin: 'DEL',
      destination: 'CDG',
      departure_date: '2025-03-22',
      return_date: '2025-03-29',
      num_adults: 1,
      num_children: 0,
      budget_usd: 2000,
      currency: 'USD',
      trip_style: 'cultural',
      accommodation_type: 'hotel',
      interests: ['art', 'history', 'food'],
      special_requirements: [],
      selected_flight: mockFlights[0],
      selected_hotel: mockHotels[0],
      weather_summary: '2025-03-22: ⛅ Clouds 8-13°C, 2025-03-23: 🌧️ Rain 6-11°C, 2025-03-24: ☀️ Clear 9-15°C',
      attractions: mockAttractions.slice(0, 5),
      budget_breakdown: mockBudget.breakdown,
    },
    status: 'confirmed',
    created_at: '2025-02-10T14:30:00Z',
    updated_at: '2025-02-15T09:00:00Z',
    messages: [
      { id: 'msg-1', role: 'user', content: 'I want to go to Paris from Delhi in late March for a week, budget around $2000', timestamp: '2025-02-10T14:30:00Z' },
      { id: 'msg-2', role: 'assistant', content: "Here's your Paris trip at a glance:\n\n**Flights (DEL → CDG):** Best option is Air India AI101 at **$742** departing 22 Mar.\n\n**Hotel:** Hotel des Arts Montmartre at **$89/night** with free cancellation.\n\n**Weather:** Cool spring weather (6-15°C). Pack a light jacket.\n\n**Top 5 things to do:** Eiffel Tower, Louvre, Musee d'Orsay, Notre-Dame, Montmartre.\n\n**Budget:** Total ~$2,173 — slightly over your $2,000 target by $173.", timestamp: '2025-02-10T14:31:00Z' },
    ],
  },
  {
    id: 'trip-002',
    user_id: 'usr-001',
    name: 'London Business Trip',
    context: {
      origin: 'DEL',
      destination: 'LHR',
      departure_date: '2025-04-10',
      return_date: '2025-04-15',
      num_adults: 1,
      num_children: 0,
      budget_usd: 3000,
      currency: 'USD',
      trip_style: 'business',
      accommodation_type: 'hotel',
      interests: ['food', 'nightlife'],
      special_requirements: ['wifi required'],
      selected_flight: null,
      selected_hotel: null,
      weather_summary: null,
      attractions: [],
      budget_breakdown: null,
    },
    status: 'planning',
    created_at: '2025-03-01T08:00:00Z',
    updated_at: '2025-03-01T08:00:00Z',
    messages: [],
  },
  {
    id: 'trip-003',
    user_id: 'usr-001',
    name: 'Tokyo Adventure',
    context: {
      origin: 'DEL',
      destination: 'NRT',
      departure_date: '2025-05-01',
      return_date: '2025-05-10',
      num_adults: 2,
      num_children: 1,
      budget_usd: 5000,
      currency: 'USD',
      trip_style: 'adventure',
      accommodation_type: 'hotel',
      interests: ['culture', 'food', 'technology'],
      special_requirements: [],
      selected_flight: null,
      selected_hotel: null,
      weather_summary: null,
      attractions: [],
      budget_breakdown: null,
    },
    status: 'planning',
    created_at: '2025-03-10T16:00:00Z',
    updated_at: '2025-03-12T10:00:00Z',
    messages: [],
  },
];
