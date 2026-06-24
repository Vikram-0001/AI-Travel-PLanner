import React, { type ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useUIStore } from '@/store/useUIStore';
import { cn } from '@/utils/helpers';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <Sidebar />
      <main
        className={cn(
          'transition-all duration-300 pt-0 min-h-[calc(100vh-4rem)]',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        )}
      >
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
