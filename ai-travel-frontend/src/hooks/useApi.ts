import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/services';
import type {
  SearchFlightsParams,
  SearchHotelsParams,
  GetWeatherParams,
  GetCurrentWeatherParams,
  SearchAttractionsParams,
  CalculateBudgetParams,
  CurrencyConvertParams,
  Trip,
} from '@/types';

// ── Flight hooks ─────────────────────────────────────────────────────────────

export function useFlights(params: SearchFlightsParams | null) {
  return useQuery({
    queryKey: ['flights', params],
    queryFn: () => api.searchFlights(params!),
    enabled: !!params,
  });
}

// ── Hotel hooks ──────────────────────────────────────────────────────────────

export function useHotels(params: SearchHotelsParams | null) {
  return useQuery({
    queryKey: ['hotels', params],
    queryFn: () => api.searchHotels(params!),
    enabled: !!params,
  });
}

// ── Weather hooks ────────────────────────────────────────────────────────────

export function useWeather(params: GetWeatherParams | null) {
  return useQuery({
    queryKey: ['weather', params],
    queryFn: () => api.getWeather(params!),
    enabled: !!params,
  });
}

export function useCurrentWeather(params: GetCurrentWeatherParams | null) {
  return useQuery({
    queryKey: ['current_weather', params],
    queryFn: () => api.getCurrentWeather(params!),
    enabled: !!params,
  });
}

// ── Attractions hooks ────────────────────────────────────────────────────────

export function useAttractions(params: SearchAttractionsParams | null) {
  return useQuery({
    queryKey: ['attractions', params],
    queryFn: () => api.searchAttractions(params!),
    enabled: !!params,
  });
}

// ── Budget hooks ─────────────────────────────────────────────────────────────

export function useBudget(params: CalculateBudgetParams | null) {
  return useQuery({
    queryKey: ['budget', params],
    queryFn: () => api.calculateBudget(params!),
    enabled: !!params,
  });
}

// ── Currency hooks ───────────────────────────────────────────────────────────

export function useCurrencyConvert(params: CurrencyConvertParams | null) {
  return useQuery({
    queryKey: ['currency', params],
    queryFn: () => api.convertCurrency(params!),
    enabled: !!params,
  });
}

// ── Trip hooks ───────────────────────────────────────────────────────────────

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: ['trip', id],
    queryFn: () => api.getTrip(id),
    enabled: !!id,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trip: Omit<Trip, 'id' | 'created_at' | 'updated_at'>) =>
      api.createTrip(trip),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Trip> }) =>
      api.updateTrip(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTrip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

// ── Profile hooks ────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: api.getUserProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<any>) => api.updateUserProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
