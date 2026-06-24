import React from 'react';
import { Link } from 'react-router-dom';
import {
  Plane,
  MapPin,
  Calendar,
  DollarSign,
  MessageSquare,
  Shield,
  Zap,
  Globe,
  ArrowRight,
  Star,
} from 'lucide-react';

const features = [
  { icon: Plane, title: 'Smart Flights', desc: 'Find the best flight deals with real-time pricing' },
  { icon: MapPin, title: 'Top Attractions', desc: 'Discover must-see places at your destination' },
  { icon: Calendar, title: 'Day-by-Day Plans', desc: 'Get detailed itineraries for every day of your trip' },
  { icon: DollarSign, title: 'Budget Tracking', desc: 'Stay on budget with smart cost breakdowns' },
  { icon: MessageSquare, title: 'AI Chat Planner', desc: 'Plan your trip conversationally with AI' },
  { icon: Globe, title: 'Weather Forecasts', desc: 'Know what to expect with 5-day weather data' },
];

const stats = [
  { value: '50K+', label: 'Trips Planned' },
  { value: '120+', label: 'Countries' },
  { value: '98%', label: 'Satisfaction' },
  { value: '24/7', label: 'AI Support' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-travel-sky flex items-center justify-center">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-xl">TravelAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-secondary text-sm">
              Sign In
            </Link>
            <Link to="/signup" className="btn-primary text-sm">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-travel-sky/5 dark:from-gray-950 dark:via-gray-900 dark:to-travel-sky/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Powered by AI
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-gray-900 dark:text-white leading-tight mb-6">
              Plan Your Dream Trip{' '}
              <span className="bg-gradient-to-r from-brand-600 to-travel-sky bg-clip-text text-transparent">
                With AI
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
              From flights to itineraries, let our AI travel planner handle everything.
              Get personalized recommendations, real-time pricing, and day-by-day plans.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup" className="btn-primary text-base px-8 py-3 flex items-center gap-2">
                Start Planning Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login" className="btn-secondary text-base px-8 py-3">
                Sign In
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {s.value}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to Travel Smart
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Our AI combines flights, hotels, weather, attractions, and budgets into one seamless plan.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="card p-6 hover:shadow-lg transition-shadow duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {f.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card p-8 sm:p-12 bg-gradient-to-br from-brand-50 to-travel-sky/5 dark:from-brand-900/10 dark:to-travel-sky/5 max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <blockquote className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 italic mb-6">
              "This AI planner saved me hours of research. It found amazing flights,
              suggested the perfect hotel, and created a day-by-day itinerary that
              covered everything I wanted to see."
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-200 dark:bg-brand-800 flex items-center justify-center font-medium text-brand-700 dark:text-brand-300">
                SK
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900 dark:text-white">Sarah K.</div>
                <div className="text-sm text-gray-500">Frequent Traveler</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-brand-600 to-travel-sky">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold text-white mb-4">
            Ready to Plan Your Next Adventure?
          </h2>
          <p className="text-brand-100 text-lg mb-8">
            Join thousands of travelers who plan smarter with AI.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-brand-700 font-semibold rounded-lg hover:bg-brand-50 transition-colors shadow-lg"
          >
            Get Started — It's Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-gray-950 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-travel-sky flex items-center justify-center">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-white">TravelAI</span>
            </div>
            <p className="text-sm">
              &copy; 2025 AI Travel Planner. Built with Groq + Amadeus + OpenWeather.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
