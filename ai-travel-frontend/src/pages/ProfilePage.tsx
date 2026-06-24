import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Globe, Bell, Save, Loader2, Camera } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useProfile, useUpdateProfile } from '@/hooks/useApi';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';
import { getInitials } from '@/utils/helpers';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  default_currency: z.string(),
  default_origin: z.string().optional(),
  trip_style: z.string().optional(),
  notifications: z.boolean(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? {
          name: profile.name,
          email: profile.email,
          default_currency: profile.preferences.default_currency,
          default_origin: profile.preferences.default_origin,
          trip_style: profile.preferences.trip_style,
          notifications: profile.preferences.notifications,
        }
      : undefined,
  });

  const onSubmit = async (data: ProfileForm) => {
    try {
      const updated = await updateProfile.mutateAsync({
        name: data.name,
        email: data.email,
        preferences: {
          default_currency: data.default_currency,
          default_origin: data.default_origin || '',
          trip_style: data.trip_style || '',
          notifications: data.notifications,
        },
      });
      setUser(updated);
      setIsEditing(false);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
          Profile
        </h1>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="btn-secondary text-sm">
            Edit Profile
          </button>
        )}
      </div>

      {/* Avatar & Info */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-400 to-travel-sky flex items-center justify-center text-2xl font-bold text-white">
              {getInitials(profile?.name || user?.name || 'U')}
            </div>
            {isEditing && (
              <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg">
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {profile?.name || user?.name}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Mail className="w-4 h-4" />
              {profile?.email || user?.email}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Recently'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Info */}
        <div className="card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-brand-500" />
            Personal Information
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input
                {...register('name')}
                className="input-field"
                disabled={!isEditing}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input
                {...register('email')}
                type="email"
                className="input-field"
                disabled={!isEditing}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        {/* Travel Preferences */}
        <div className="card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-500" />
            Travel Preferences
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Default Currency</label>
              <select {...register('default_currency')} className="input-field" disabled={!isEditing}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
            <div>
              <label className="label">Default Origin</label>
              <input
                {...register('default_origin')}
                className="input-field"
                placeholder="e.g. DEL, NYC"
                disabled={!isEditing}
              />
            </div>
          </div>
          <div>
            <label className="label">Preferred Trip Style</label>
            <select {...register('trip_style')} className="input-field" disabled={!isEditing}>
              <option value="">Select style...</option>
              <option value="adventure">Adventure</option>
              <option value="relaxing">Relaxing</option>
              <option value="cultural">Cultural</option>
              <option value="business">Business</option>
              <option value="romantic">Romantic</option>
              <option value="family">Family</option>
              <option value="backpacking">Backpacking</option>
            </select>
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-brand-500" />
            Notifications
          </h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              {...register('notifications')}
              type="checkbox"
              disabled={!isEditing}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Receive trip updates and deal alerts
            </span>
          </label>
        </div>

        {/* Actions */}
        {isEditing && (
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                reset();
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {updateProfile.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
