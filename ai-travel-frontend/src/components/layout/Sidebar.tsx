import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  Plane,
  MessageSquare,
  User,
  Compass,
} from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { cn } from '@/utils/helpers';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/trips', label: 'My Trips', icon: Map },
  { path: '/plan', label: 'Plan Trip', icon: Plane },
  { path: '/chat', label: 'AI Chat', icon: MessageSquare },
  { path: '/profile', label: 'Profile', icon: User },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarOpen } = useUIStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" />
      )}
      <aside
        className={cn(
          'fixed top-16 left-0 z-30 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full p-4">
          {/* Quick create */}
          <Link
            to="/plan"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-600 to-travel-sky text-white rounded-xl font-medium shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 transition-all mb-6"
          >
            <Compass className="w-5 h-5" />
            Plan New Trip
          </Link>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="px-4 py-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-800/30">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
                Pro Tip
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                Use AI Chat for conversational trip planning
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
