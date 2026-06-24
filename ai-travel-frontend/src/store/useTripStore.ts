import { create } from 'zustand';
import type { TripContext, ChatMessage } from '@/types';

interface TripState {
  currentContext: TripContext;
  chatMessages: ChatMessage[];
  setContext: (ctx: Partial<TripContext>) => void;
  resetContext: () => void;
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
}

const defaultContext: TripContext = {
  origin: null,
  destination: null,
  departure_date: null,
  return_date: null,
  num_adults: 1,
  num_children: 0,
  budget_usd: null,
  currency: 'USD',
  trip_style: null,
  accommodation_type: null,
  interests: [],
  special_requirements: [],
  selected_flight: null,
  selected_hotel: null,
  weather_summary: null,
  attractions: [],
  budget_breakdown: null,
};

export const useTripStore = create<TripState>((set) => ({
  currentContext: { ...defaultContext },
  chatMessages: [],
  setContext: (ctx) =>
    set((state) => ({
      currentContext: { ...state.currentContext, ...ctx },
    })),
  resetContext: () => set({ currentContext: { ...defaultContext }, chatMessages: [] }),
  addMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  clearMessages: () => set({ chatMessages: [] }),
}));
