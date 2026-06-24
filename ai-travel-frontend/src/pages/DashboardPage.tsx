import React from 'react';
import { Link } from 'react-router-dom';
import {
  Plane,
  MapPin,
  DollarSign,
  Calendar,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useTrips } from '@/hooks/useApi';
import { useAuthStore } from '@/store/useAuthStore';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDate, formatCurrency, daysUntil, getTripStatusColor, cn } from '@/utils/helpers';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: trips, isLoading } = useTrips();

  const upcomingTrips = (trips || []).filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.context.departure_date
  );
  const recentTrips = (trips || []).slice(0, 3);
  const totalTrips = (trips || []).length;
  const totalBudget = (trips || []).reduce(
    (sum, t) => sum + (t.context.budget_usd || 0),
    0
  );
  const countriesVisited = new Set(
    (trips || []).map((t) => t.context.destination).filter(Boolean)
  ).size;

  const stats = [
    {
      label: 'Total Trips',
      value: totalTrips,
      icon: Plane,
      color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Total Budget',
      value: formatCurrency(totalBudget),
      icon: DollarSign,
      color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    },
    {
      label: 'Destinations',
      value: countriesVisited,
      icon: MapPin,
      color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    },
    {
      label: 'Upcoming',
      value: upcomingTrips.length,
      icon: Calendar,
      color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name?.split(' ')[0] || 'Traveler'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Here's what's happening with your trips
          </p>
        </div>
        <Link to="/plan" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Plan New Trip
        </Link>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', s.color)}>
                  <s.icon className="w-5 h-5" />
                </div>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {s.value}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming Trips */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-500" />
            Upcoming Trips
          </h2>
          <Link to="/trips" className="text-sm text-brand-600 dark:text-brand-400 font-medium hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : upcomingTrips.length === 0 ? (
          <EmptyState
            icon={Plane}
            title="No upcoming trips"
            description="Start planning your next adventure"
            action={
              <Link to="/plan" className="btn-primary">
                Plan a Trip
              </Link>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingTrips.map((trip) => {
              const days = daysUntil(trip.context.departure_date!);
              return (
                <Link
                  key={trip.id}
                  to={`/trips/${trip.id}`}
                  className="card p-5 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {trip.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {trip.context.origin} → {trip.context.destination}
                      </p>
                    </div>
                    <span className={cn('text-xs px-2 py-1 rounded-full font-medium', getTripStatusColor(trip.status))}>
                      {trip.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {trip.context.departure_date ? formatDate(trip.context.departure_date) : 'TBD'}
                    </span>
                    {days > 0 && (
                      <span className="text-brand-600 dark:text-brand-400 font-medium">
                        in {days} days
                      </span>
                    )}
                  </div>
                  {trip.context.budget_usd && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Budget: {formatCurrency(trip.context.budget_usd, trip.context.currency)}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Trips
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : recentTrips.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No trips yet"
            description="Your trip history will appear here"
          />
        ) : (
          <div className="card divide-y divide-gray-100 dark:divide-gray-700">
            {recentTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {trip.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {trip.context.origin} → {trip.context.destination} · {formatDate(trip.updated_at)}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Trip', icon: Plus, to: '/plan', color: 'from-brand-500 to-brand-600' },
            { label: 'AI Chat', icon: TrendingUp, to: '/chat', color: 'from-purple-500 to-purple-600' },
            { label: 'My Trips', icon: MapPin, to: '/trips', color: 'from-travel-sky to-travel-ocean' },
            { label: 'Profile', icon: Plane, to: '/profile', color: 'from-orange-500 to-travel-sunset' },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="card p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all group"
            >
              <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center group-hover:scale-110 transition-transform', action.color)}>
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
