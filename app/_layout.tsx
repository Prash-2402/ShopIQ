import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { subscribeAuthState } from '../services/firebase/auth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Toast } from '../components/Toast';
import { useToastStore } from '../store/toastStore';
import { syncPendingBills } from '../services/supabase/billing';
import '../global.css';

// Create a single QueryClient instance for the entire application
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, storeName, setSession } = useAuthStore();
  const { showToast } = useToastStore();

  useEffect(() => {
    const unsubscribe = subscribeAuthState((user) => {
      if (user) {
        setSession({
          phone: user.phone,
          storeName: user.storeName,
          isAuthenticated: true,
        });
      } else {
        setSession({
          phone: null,
          storeName: null,
          isAuthenticated: false,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const segmentsArray = segments as unknown as string[];
    const inAuthGroup = segmentsArray[0] === '(auth)';
    const isRoot = segmentsArray.length === 0;

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      if (!storeName) {
        if (segmentsArray[1] !== 'onboarding') {
          router.replace('/(auth)/onboarding');
        }
      } else {
        if (inAuthGroup || isRoot) {
          router.replace('/(tabs)');
        }
      }
    }
  }, [isAuthenticated, isLoading, storeName, segments]);

  // Background auto-sync loop (triggers every 30 seconds when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;

    // Run first sync immediately on boot
    const runSync = async () => {
      try {
        const { successCount, failedCount } = await syncPendingBills();
        if (successCount > 0) {
          showToast(`Successfully synced ${successCount} offline bills to cloud!`, 'success');
        }
        if (failedCount > 0) {
          showToast(`Offline sync pending (${failedCount} failed). Retrying in background.`, 'warning');
        }
      } catch (err) {
        console.warn('Background auto-sync failed:', err);
      }
    };

    runSync();

    const intervalId = setInterval(runSync, 30000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#0A0E1A] items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <View className="flex-1 bg-[#0A0E1A]">
          <Stack screenOptions={{ headerShown: false }} />
          <Toast />
        </View>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
