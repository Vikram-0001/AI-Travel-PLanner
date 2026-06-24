import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  MapPin,
  Calendar,
  DollarSign,
  MoreVertical,
  Trash2,
  Edit,
  Search,
} from 'lucide-react';
import { useTrips, useDeleteTrip } from '@/hooks/useApi';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDate, formatCurrency, daysUntil, getTripStatusColor, cn } from '@/utils/helpers';
import toast from 'react-hot-toast';

export function TripsPage() {
  const { data: trips, isLoading } = useTrips();
  const deleteTrip = useDeleteTrip();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = (trips || []).filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.context.destination || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteTrip.mutateAsync(id);
      toast.success('Trip deleted');
    } catch {
      toast.error('Failed to delete trip');
    }
    setOpenMenu(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-gray-900 dark:text-white">
            My Trips
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage and view all your planned trips
          </p>
        </div>
        <Link to="/plan" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Trip
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Search trips..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field sm:w-40"
        >
          <option value="all">All Status</option>
          <option value="planning">Planning</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Trip List */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={search ? 'No trips found' : 'No trips yet'}
          description={search ? 'Try a different search term' : 'Start planning your first adventure'}
          action={
            !search ? (
              <Link to="/plan" className="btn-primary">
                Plan a Trip
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((trip) => {
            const days = trip.context.departure_date ? daysUntil(trip.context.departure_date) : null;
            return (
              <div key={trip.id} className="card overflow-hidden group relative">
                {/* Menu */}
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => setOpenMenu(openMenu === trip.id ? null : trip.id)}
                    className="p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur hover:bg-white dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-500" />
                  </button>
                  {openMenu === trip.id && (
                    <div className="absolute right-0 top-8 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                      <Link
                        to={`/trips/${trip.id}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => setOpenMenu(null)}
                      >
                        <Edit className="w-4 h-4" /> View Details
                      </Link>
                      <button
                        onClick={() => handleDelete(trip.id, trip.name)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>

                <Link to={`/trips/${trip.id}`} className="block p-5">
                  {/* Header */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getTripStatusColor(trip.status))}>
                        {trip.status}
                      </span>
                      {days !== null && days > 0 && (
                        <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                          in {days} days
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                      {trip.name}
                    </h3>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                    <MapPin className="w-4 h-4" />
                    <span>{trip.context.origin} → {trip.context.destination}</span>
                  </div>

                  {/* Details */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    {trip.context.departure_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(trip.context.departure_date)}
                      </span>
                    )}
                    {trip.context.budget_usd && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        {formatCurrency(trip.context.budget_usd, trip.context.currency)}
                      </span>
                    )}
                  </div>

                  {/* Travelers */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{trip.context.num_adults} adult{trip.context.num_adults > 1 ? 's' : ''}</span>
                    {trip.context.num_children > 0 && (
                      <span>· {trip.context.num_children} child{trip.context.num_children > 1 ? 'ren' : ''}</span>
                    )}
                    {trip.context.trip_style && (
                      <span className="ml-auto capitalize">{trip.context.trip_style}</span>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
