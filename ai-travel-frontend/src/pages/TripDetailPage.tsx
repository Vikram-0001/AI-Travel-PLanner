import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plane,
  Building2,
  Cloud,
  MapPin,
  IndianRupee,
  Download,
  Trash2,
  Edit,
  Loader2,
  Users,
  Calendar,
} from 'lucide-react';
import { useTrip, useDeleteTrip, useFlights, useHotels, useCurrentWeather, useAttractions, useBudget } from '@/hooks/useApi';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';
import { formatDate, formatCurrencyINR, cn } from '@/utils/helpers';
import toast from 'react-hot-toast';

export function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: trip, isLoading } = useTrip(id!);
  const deleteTrip = useDeleteTrip();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch data based on trip context
  const flightParams = trip?.context.origin && trip?.context.destination && trip?.context.departure_date
    ? {
        origin: trip.context.origin,
        destination: trip.context.destination,
        departure_date: trip.context.departure_date,
        return_date: trip.context.return_date || undefined,
        adults: trip.context.num_adults,
        children: trip.context.num_children,
        currency: trip.context.currency,
      }
    : null;

  const hotelParams = trip?.context.destination && trip?.context.departure_date && trip?.context.return_date
    ? {
        city_code: trip.context.destination,
        check_in: trip.context.departure_date,
        check_out: trip.context.return_date,
        adults: trip.context.num_adults,
        currency: trip.context.currency,
      }
    : null;

  const weatherParams = trip?.context.destination
    ? { city: trip.context.destination, country_code: '' }
    : null;

  const attractionParams = trip?.context.destination
    ? { city_code: trip.context.destination, max_results: 8 }
    : null;

  const budgetParams = trip?.context.budget_usd
    ? (() => {
        // Calculate nights from departure and return dates
        const dep = trip.context.departure_date ? new Date(trip.context.departure_date) : null;
        const ret = trip.context.return_date ? new Date(trip.context.return_date) : null;
        const nights = dep && ret ? Math.max(1, Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24))) : 7;
        const numTravellers = trip.context.num_adults + trip.context.num_children;
        return {
          // Prices from real API calls are already in INR
          flight_cost: trip.context.selected_flight?.total_price || undefined,
          hotel_cost_per_night: trip.context.selected_hotel?.price_per_night || undefined,
          nights,
          daily_food_budget: 4000,         // ₹4,000 per person per day
          daily_transport_budget: 1500,    // ₹1,500 per person per day
          activity_budget: 8000,           // ₹8,000 total activities
          num_travellers: numTravellers,
          currency: 'INR',
          total_budget: trip.context.budget_usd,  // stored as INR total
        };
      })()
    : null;

  const { data: flights, isLoading: flightsLoading } = useFlights(flightParams);
  const { data: hotels, isLoading: hotelsLoading } = useHotels(hotelParams);
  const { data: weather, isLoading: weatherLoading } = useCurrentWeather(weatherParams);
  const { data: attractions, isLoading: attractionsLoading } = useAttractions(attractionParams);
  const { data: budget, isLoading: budgetLoading } = useBudget(budgetParams);

  const handleDelete = async () => {
    if (!confirm('Delete this trip?')) return;
    try {
      await deleteTrip.mutateAsync(id!);
      toast.success('Trip deleted');
      navigate('/trips');
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Trip not found</h2>
        <Link to="/trips" className="text-brand-600 hover:underline">Back to trips</Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: MapPin },
    { id: 'flights', label: 'Flights', icon: Plane },
    { id: 'hotels', label: 'Hotels', icon: Building2 },
    { id: 'weather', label: 'Weather', icon: Cloud },
    { id: 'attractions', label: 'Attractions', icon: MapPin },
    { id: 'budget', label: 'Budget (₹)', icon: IndianRupee },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/trips')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
              {trip.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              {trip.context.origin} → {trip.context.destination}
              {trip.context.departure_date && ` · ${formatDate(trip.context.departure_date)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} className="btn-secondary text-sm flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          <button className="btn-primary text-sm flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Trip Info Bar */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-500" />
            <span className="text-gray-500 dark:text-gray-400">Departure:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {trip.context.departure_date ? formatDate(trip.context.departure_date) : 'TBD'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-500" />
            <span className="text-gray-500 dark:text-gray-400">Return:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {trip.context.return_date ? formatDate(trip.context.return_date) : 'TBD'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-500" />
            <span className="font-medium text-gray-900 dark:text-white">
              {trip.context.num_adults} adult{trip.context.num_adults > 1 ? 's' : ''}
              {trip.context.num_children > 0 ? `, ${trip.context.num_children} child${trip.context.num_children > 1 ? 'ren' : ''}` : ''}
            </span>
          </div>
          {trip.context.budget_usd && (
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-brand-500" />
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrencyINR(trip.context.budget_usd, 'INR')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 overflow-x-auto pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'overview' && (
          <OverviewTab trip={trip} flights={flights} hotels={hotels} weather={weather} attractions={attractions} budget={budget} />
        )}
        {activeTab === 'flights' && <FlightsTab flights={flights} loading={flightsLoading} />}
        {activeTab === 'hotels' && <HotelsTab hotels={hotels} loading={hotelsLoading} />}
        {activeTab === 'weather' && <WeatherTab weather={weather} loading={weatherLoading} />}
        {activeTab === 'attractions' && <AttractionsTab attractions={attractions} loading={attractionsLoading} />}
        {activeTab === 'budget' && <BudgetTab budget={budget} loading={budgetLoading} currency={trip.context.currency} />}
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ trip, flights, hotels, weather, attractions, budget }: any) {
  return (
    <div className="space-y-6">
      {/* Trip Context */}
      {trip.context.trip_style && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Trip Style</h3>
          <p className="text-gray-600 dark:text-gray-400 capitalize">{trip.context.trip_style}</p>
          {trip.context.interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {trip.context.interests.map((i: string) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 capitalize">
                  {i}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick Flight Summary */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Plane className="w-5 h-5 text-brand-500" /> Best Flight
          </h3>
          {flights?.[0] ? (
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyINR(flights[0].total_price, flights[0].currency)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {flights[0].legs.map((l: any) => `${l.from} → ${l.to}`).join(' via ')}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {flights[0].legs[0]?.carrier} {flights[0].legs[0]?.flight_no}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No flight data available</p>
          )}
        </div>

        {/* Quick Hotel Summary */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-500" /> Best Hotel
          </h3>
          {hotels?.[0] ? (
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{hotels[0].name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {'★'.repeat(parseInt(hotels[0].rating))} · {hotels[0].room_type}
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrencyINR(hotels[0].price_per_night, hotels[0].currency)}/night
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No hotel data available</p>
          )}
        </div>

        {/* Weather Summary */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-brand-500" /> Current Weather
          </h3>
          {weather ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Condition</span>
                <span className="font-medium text-gray-900 dark:text-white">{weather.emoji} {weather.condition}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Temperature</span>
                <span className="font-medium text-gray-900 dark:text-white">{weather.temp_c}°C</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Feels Like</span>
                <span className="font-medium text-gray-900 dark:text-white">{weather.feels_like_c}°C</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Humidity</span>
                <span className="font-medium text-gray-900 dark:text-white">{weather.humidity_pct}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Wind</span>
                <span className="font-medium text-gray-900 dark:text-white">{weather.wind_kmh} km/h</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No weather data</p>
          )}
        </div>

        {/* Budget Summary */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-brand-500" /> Budget Overview
          </h3>
          {budget?.breakdown ? (
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyINR(budget.breakdown.TOTAL, budget.breakdown.currency)}
              </div>
              {budget.over_budget && (
                <p className="text-red-500 text-sm mt-1">
                  Over budget by {formatCurrencyINR(budget.over_budget, budget.breakdown.currency)}
                </p>
              )}
              <div className="mt-3 space-y-1 text-sm">
                {Object.entries(budget.breakdown)
                  .filter(([k]) => !['TOTAL', 'currency', 'per_person'].includes(k))
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                      <span>{formatCurrencyINR(val as number, budget.breakdown.currency)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No budget data</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Flights Tab ──────────────────────────────────────────────────────────────

function FlightsTab({ flights, loading }: { flights: FlightOffer[] | undefined; loading: boolean }) {
  if (loading) return <CardSkeleton />;
  if (!flights?.length) return <p className="text-gray-400 text-center py-12">No flight data available</p>;

  return (
    <div className="space-y-4">
      {flights.map((flight, i) => (
        <div key={flight.id} className="card p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Option #{i + 1}</span>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrencyINR(flight.total_price, flight.currency)}
              </div>
            </div>
            {flight.seats_left && (
              <span className="text-xs px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                {flight.seats_left} seats left
              </span>
            )}
          </div>
          <div className="space-y-3">
            {flight.legs.map((leg, j) => (
              <div key={j} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="text-center min-w-[60px]">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{leg.from}</div>
                  <div className="text-xs text-gray-500">{leg.dep?.split(' ')[1]}</div>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
                  <div className="text-center px-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{leg.carrier}</div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{leg.flight_no}</div>
                    <div className="text-xs text-gray-400">{leg.duration}min · {leg.stops} stop{leg.stops !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
                </div>
                <div className="text-center min-w-[60px]">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{leg.to}</div>
                  <div className="text-xs text-gray-500">{leg.arr?.split(' ')[1]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hotels Tab ───────────────────────────────────────────────────────────────

function HotelsTab({ hotels, loading }: { hotels: HotelOffer[] | undefined; loading: boolean }) {
  if (loading) return <CardSkeleton />;
  if (!hotels?.length) return <p className="text-gray-400 text-center py-12">No hotel data available</p>;

  return (
    <div className="space-y-4">
      {hotels.map((hotel) => (
        <div key={hotel.hotel_id} className="card p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{hotel.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-yellow-500">{'★'.repeat(parseInt(hotel.rating))}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{hotel.room_type}</span>
                {hotel.beds && <span className="text-sm text-gray-400">· {hotel.beds}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyINR(hotel.price_per_night, hotel.currency)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">per night</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">
                Total: {formatCurrencyINR(hotel.total_price, hotel.currency)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            {hotel.cancellable && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                Free cancellation
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Check-in: {formatDate(hotel.check_in)} · Check-out: {formatDate(hotel.check_out)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Weather Tab ──────────────────────────────────────────────────────────────

function WeatherTab({ weather, loading }: { weather: WeatherData | undefined; loading: boolean }) {
  if (loading) return <CardSkeleton />;
  if (!weather) return <p className="text-gray-400 text-center py-12">No weather data available</p>;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Current Weather in {weather.city}, {weather.country}
        </h3>
        
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Current Condition */}
          <div className="text-center lg:text-left">
            <div className="text-6xl mb-4">{weather.emoji}</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {weather.temp_c}°C
            </div>
            <div className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-1">
              {weather.condition}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {weather.description}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Feels like {weather.feels_like_c}°C
            </div>
          </div>

          {/* Weather Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Humidity</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {weather.humidity_pct}%
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Wind Speed</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {weather.wind_kmh} km/h
              </div>
            </div>
            {weather.pressure_hpa && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Pressure</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {weather.pressure_hpa} hPa
                </div>
              </div>
            )}
            {weather.visibility_km && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Visibility</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {weather.visibility_km} km
                </div>
              </div>
            )}
            {weather.cloudiness_pct !== undefined && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Cloud Cover</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {weather.cloudiness_pct}%
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Attractions Tab ──────────────────────────────────────────────────────────

function AttractionsTab({ attractions, loading }: { attractions: Attraction[] | undefined; loading: boolean }) {
  if (loading) return <CardSkeleton />;
  if (!attractions?.length) return <p className="text-gray-400 text-center py-12">No attractions data available</p>;

  const categoryColors: Record<string, string> = {
    LANDMARK: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    MUSEUM: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    PARK: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    RESTAURANT: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {attractions.map((a, i) => (
        <div key={i} className="card p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{a.name}</h3>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block', categoryColors[a.category] || 'bg-gray-100 text-gray-600')}>
                {a.category}
              </span>
            </div>
            {a.rank && (
              <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-sm font-bold text-brand-600 dark:text-brand-400">
                #{a.rank}
              </div>
            )}
          </div>
          {a.tags && a.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {a.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Budget Tab ───────────────────────────────────────────────────────────────

function BudgetTab({ budget, loading, currency }: { budget: BudgetResult | undefined; loading: boolean; currency: string }) {
  if (loading) return <CardSkeleton />;
  if (!budget?.breakdown) return <p className="text-gray-400 text-center py-12">No budget data available</p>;

  const items = Object.entries(budget.breakdown).filter(
    ([k]) => !['TOTAL', 'currency', 'per_person'].includes(k)
  );

  const maxVal = Math.max(...items.map(([, v]) => v as number));

  return (
    <div className="max-w-2xl">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-brand-500" /> Budget Breakdown (INR)
        </h3>
        <div className="space-y-4">
          {items.map(([key, val]) => {
            const pct = ((val as number) / maxVal) * 100;
            return (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-gray-700 dark:text-gray-300">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrencyINR(val as number, currency)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-travel-sky rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrencyINR(budget.breakdown.TOTAL, currency)}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500 dark:text-gray-400">Per person</span>
            <span className="text-gray-700 dark:text-gray-300">
              {formatCurrencyINR(budget.breakdown.per_person, currency)}
            </span>
          </div>
          {budget.over_budget && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                Over budget by {formatCurrencyINR(budget.over_budget, currency)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
