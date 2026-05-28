import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase/config';

export default function OnboardingScreen() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phone = useAuthStore((state) => state.phone);
  const setStore = useAuthStore((state) => state.setStoreName);

  const handleSaveStore = async () => {
    if (storeName.trim().length === 0 || !phone) return;
    setLoading(true);
    setError(null);

    try {
      const { error: supabaseError } = await supabase
        .from('users')
        .update({ store_name: storeName.trim() })
        .eq('phone', phone);

      if (supabaseError) {
        throw supabaseError;
      }

      setStore(storeName.trim());
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to complete store onboarding setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#0A0E1A]"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-between px-6 pt-24 pb-12">
          {/* Header */}
          <View className="mt-8">
            <Text className="text-white text-3xl font-extrabold tracking-tight">One Last Step</Text>
            <Text className="text-gray-400 text-base mt-2">
              Let's set up your store profile
            </Text>
          </View>

          {/* Form */}
          <View className="w-full bg-[#13192B] border border-gray-800 rounded-3xl p-6 shadow-xl">
            <Text className="text-white text-xl font-bold mb-2">Store Details</Text>
            <Text className="text-gray-400 text-sm mb-6">Enter your Kirana store/shop name</Text>

            {error && (
              <View className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4 mb-4">
                <Text className="text-red-400 text-sm font-semibold">{error}</Text>
              </View>
            )}

            <View className="bg-[#0F1424] border border-gray-800 rounded-2xl px-4 py-4 mb-6">
              <TextInput
                className="text-white font-semibold text-lg"
                placeholder="e.g., Sharma Kirana Store"
                placeholderTextColor="#4B5563"
                value={storeName}
                onChangeText={(val) => {
                  setStoreName(val);
                  if (error) setError(null);
                }}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveStore}
              disabled={storeName.trim().length === 0 || loading}
              className={`w-full py-4 rounded-2xl items-center justify-center shadow-md ${
                storeName.trim().length > 0 && !loading ? 'bg-indigo-600 shadow-indigo-500/30' : 'bg-gray-800 opacity-50'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white text-lg font-bold">Complete Setup</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="items-center mt-6">
            <Text className="text-gray-500 text-xs text-center">
              You can change this later in your profile settings
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
