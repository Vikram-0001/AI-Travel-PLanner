import { format, formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

// Static currency rates (USD base, used as fallback)
const STATIC_RATES: Record<string, number> = {
  'USD': 1.0,
  'EUR': 0.92,
  'GBP': 0.79,
  'INR': 84.0,
  'JPY': 149.0,
  'AUD': 1.53,
  'CAD': 1.36,
  'SGD': 1.34,
  'AED': 3.67,
  'THB': 35.5,
};

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function daysUntil(dateStr: string): number {
  try {
    return differenceInDays(parseISO(dateStr), new Date());
  } catch {
    return 0;
  }
}

export function convertToINR(amount: number, fromCurrency: string = 'USD'): number {
  const from = fromCurrency.toUpperCase();
  // If already INR, return directly — no conversion needed
  if (from === 'INR') return Math.round(amount * 100) / 100;
  const baseUSD = amount / (STATIC_RATES[from] || 1.0);
  const inINR = baseUSD * (STATIC_RATES['INR'] || 84.0);
  return Math.round(inINR * 100) / 100;
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyINR(amount: number, fromCurrency: string = 'INR'): string {
  // If already in INR (or no currency specified), display directly without conversion
  const inr = convertToINR(amount, fromCurrency);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(inr);
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getWeatherBg(condition: string): string {
  const map: Record<string, string> = {
    Clear: 'from-yellow-400 to-orange-400',
    Clouds: 'from-gray-400 to-gray-500',
    Rain: 'from-blue-400 to-blue-600',
    Drizzle: 'from-blue-300 to-blue-500',
    Thunderstorm: 'from-purple-500 to-gray-700',
    Snow: 'from-blue-100 to-blue-300',
    Mist: 'from-gray-300 to-gray-400',
    Fog: 'from-gray-300 to-gray-500',
    Haze: 'from-yellow-200 to-gray-300',
  };
  return map[condition] || 'from-gray-400 to-gray-500';
}

export function getTripStatusColor(status: string): string {
  const map: Record<string, string> = {
    planning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
}
