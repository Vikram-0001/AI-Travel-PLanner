import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LandingPage } from '@/components/landing/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlanTripPage } from '@/pages/PlanTripPage';
import { TripsPage } from '@/pages/TripsPage';
import { TripDetailPage } from '@/pages/TripDetailPage';
import { ChatPage } from '@/pages/ChatPage';
import { ProfilePage } from '@/pages/ProfilePage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <Layout>
            <DashboardPage />
          </Layout>
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/plan',
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <Layout>
            <PlanTripPage />
          </Layout>
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/trips',
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <Layout>
            <TripsPage />
          </Layout>
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/trips/:id',
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <Layout>
            <TripDetailPage />
          </Layout>
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/chat',
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <Layout>
            <ChatPage />
          </Layout>
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <Layout>
            <ProfilePage />
          </Layout>
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
