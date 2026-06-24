import React, { useEffect } from 'react';
import { AppRouter } from '@/router';
import { ToastProvider } from '@/components/common/Toast';
import { useUIStore } from '@/store/useUIStore';
import { useAuthStore } from '@/store/useAuthStore';

export default function App() {
  const { darkMode } = useUIStore();
  const { setLoading } = useAuthStore();

  useEffect(() => {
    // Apply dark mode on mount
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Mark auth as loaded
    setLoading(false);
  }, []);

  return (
    <>
      <AppRouter />
      <ToastProvider />
    </>
  );
}
