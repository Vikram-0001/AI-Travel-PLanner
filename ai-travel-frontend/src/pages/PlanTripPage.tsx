import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plane,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Compass,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useCreateTrip } from '@/hooks/useApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useTripStore } from '@/store/useTripStore';
import toast from 'react-hot-toast';
import type { TripContext } from '@/types';

const tripFormSchema = z.object({
  name: z.string().min(2, 'Trip name is required'),
  origin: z.string().min(2, 'Origin is required'),
  destination: z.string().min(2, 'Destination is required'),
  departure_date: z.string().min(1, 'Departure date is required'),
  return_date: z.string().min(1, 'Return date is required'),
  num_adults: z.number().min(1).max(20),
  num_children: z.number().min(0).max(20),
  budget_usd: z.number().min(0),
  currency: z.string(),
  trip_style: z.string().optional(),
  accommodation_type: z.string().optional(),
  interests: z.string().optional(),
});

type TripFormData = z.infer<typeof tripFormSchema>;

const tripStyles = ['adventure', 'relaxing', 'cultural', 'business', 'romantic', 'family', 'backpacking'];
const accommodationTypes = ['hotel', 'hostel', 'airbnb', 'resort', 'villa'];
const interestOptions = ['art', 'history', 'food', 'nightlife', 'nature', 'shopping', 'adventure', 'beach', 'hiking', 'photography', 'architecture', 'music'];

export function PlanTripPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const createTrip = useCreateTrip();
  const { setContext } = useTripStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      name: '',
      origin: '',
      destination: '',
      departure_date: '',
      return_date: '',
      num_adults: 1,
      num_children: 0,
      budget_usd: 100000,
      currency: 'INR',
      trip_style: '',
      accommodation_type: '',
      interests: '',
    },
  });

  const onSubmit = async (data: TripFormData) => {
    setIsSubmitting(true);
    try {
      const interests = data.interests
        ? data.interests.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const context: TripContext = {
        origin: data.origin.toUpperCase(),
        destination: data.destination.toUpperCase(),
        departure_date: data.departure_date,
        return_date: data.return_date,
        num_adults: data.num_adults,
        num_children: data.num_children,
        budget_usd: data.budget_usd,
        currency: data.currency,
        trip_style: data.trip_style || null,
        accommodation_type: data.accommodation_type || null,
        interests,
        special_requirements: [],
        selected_flight: null,
        selected_hotel: null,
        weather_summary: null,
        attractions: [],
        budget_breakdown: null,
      };

      const trip = await createTrip.mutateAsync({
        user_id: user?.id || '',
        name: data.name,
        context,
        status: 'planning',
        messages: [],
      });

      setContext(context);
      toast.success('Trip created! Let\'s plan it.');
      navigate(`/trips/${trip.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-travel-sky flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          Plan a New Trip
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Fill in the details and our AI will create a personalized travel plan for you
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Trip Name */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-brand-500" />
            Trip Details
          </h2>
          <div>
            <label className="label">Trip Name</label>
            <input
              {...register('name')}
              className="input-field"
              placeholder="e.g. Paris Spring Getaway"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>
        </div>

        {/* Route */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Plane className="w-5 h-5 text-brand-500" />
            Route
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Origin (City or IATA code)</label>
              <input
                {...register('origin')}
                className="input-field"
                placeholder="e.g. Delhi or DEL"
              />
              {errors.origin && <p className="text-red-500 text-sm mt-1">{errors.origin.message}</p>}
            </div>
            <div>
              <label className="label">Destination (City or IATA code)</label>
              <input
                {...register('destination')}
                className="input-field"
                placeholder="e.g. Paris or CDG"
              />
              {errors.destination && <p className="text-red-500 text-sm mt-1">{errors.destination.message}</p>}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-500" />
            Travel Dates
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Departure Date</label>
              <input
                {...register('departure_date')}
                type="date"
                className="input-field"
              />
              {errors.departure_date && <p className="text-red-500 text-sm mt-1">{errors.departure_date.message}</p>}
            </div>
            <div>
              <label className="label">Return Date</label>
              <input
                {...register('return_date')}
                type="date"
                className="input-field"
              />
              {errors.return_date && <p className="text-red-500 text-sm mt-1">{errors.return_date.message}</p>}
            </div>
          </div>
        </div>

        {/* Travelers */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-500" />
            Travelers
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Adults</label>
              <input
                {...register('num_adults', { valueAsNumber: true })}
                type="number"
                min={1}
                max={20}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Children</label>
              <input
                {...register('num_children', { valueAsNumber: true })}
                type="number"
                min={0}
                max={20}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-brand-500" />
            Budget (₹ INR)
          </h2>
          <div>
            <label className="label">Total Budget in ₹ (Indian Rupees)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
              <input
                {...register('budget_usd', { valueAsNumber: true })}
                type="number"
                min={0}
                step={1000}
                className="input-field pl-8"
                placeholder="100000"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">This is your total available budget. All expenses will be tracked in INR (₹).</p>
            {/* Hidden currency field always set to INR */}
            <input type="hidden" {...register('currency')} value="INR" />
          </div>
        </div>

        {/* Preferences */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-500" />
            Preferences
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Trip Style</label>
              <select {...register('trip_style')} className="input-field">
                <option value="">Select style...</option>
                {tripStyles.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Accommodation</label>
              <select {...register('accommodation_type')} className="input-field">
                <option value="">Select type...</option>
                {accommodationTypes.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Interests (comma-separated)</label>
            <input
              {...register('interests')}
              className="input-field"
              placeholder="e.g. art, food, history"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {interestOptions.map((interest) => (
                <span
                  key={interest}
                  className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  onClick={() => {
                    const current = watch('interests') || '';
                    const interests = current.split(',').map((s) => s.trim()).filter(Boolean);
                    if (!interests.includes(interest)) {
                      interests.push(interest);
                    }
                  }}
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Create Trip
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
