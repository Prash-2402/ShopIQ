import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { syncSupabaseUser, sendOTP } from '../../services/firebase/auth';

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(30);

  const confirmationResult = useAuthStore((state) => state.confirmationResult);
  const setSession = useAuthStore((state) => state.setSession);
  const setConfirmationResult = useAuthStore((state) => state.setConfirmationResult);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleVerifyOTP = async () => {
    if (otp.length !== 6 || !confirmationResult) return;
    setLoading(true);
    setError(null);

    try {
      const result = await confirmationResult.confirm(otp);
      const firebaseUser = result.user;
      
      if (firebaseUser && (firebaseUser.phoneNumber || phone)) {
        const userPhone = firebaseUser.phoneNumber || phone;
        const syncedUser = await syncSupabaseUser(userPhone);

        setSession({
          phone: syncedUser.phone,
          storeName: syncedUser.storeName,
          isAuthenticated: true,
        });

        if (syncedUser.storeName) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/onboarding');
        }
      } else {
        throw new Error('Failed to retrieve user phone verification data.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Verification failed. Please enter the correct code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0 || !phone) return;
    setLoading(true);
    setError(null);
    try {
      const confirmation = await sendOTP(phone);
      setConfirmationResult(confirmation);
      setTimer(30);
      alert('Verification code resent successfully.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to resend verification code.');
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
            <TouchableOpacity onPress={() => router.back()} className="mb-6" disabled={loading}>
              <Text className="text-indigo-400 font-semibold text-lg">← Back</Text>
            </TouchableOpacity>
            <Text className="text-white text-3xl font-extrabold tracking-tight">Verify Code</Text>
            <Text className="text-gray-400 text-base mt-2">
              Sent a 6-digit OTP code to <Text className="text-white font-semibold">+91 {phone}</Text>
            </Text>
          </View>

          {/* Form */}
          <View className="w-full bg-[#13192B] border border-gray-800 rounded-3xl p-6 shadow-xl">
            <Text className="text-white text-xl font-bold mb-2">Enter OTP</Text>
            <Text className="text-gray-400 text-sm mb-6">Type the 6-digit code to log in</Text>

            {error && (
              <View className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4 mb-4">
                <Text className="text-red-400 text-sm font-semibold">{error}</Text>
              </View>
            )}

            <View className="bg-[#0F1424] border border-gray-800 rounded-2xl px-4 py-4 mb-6">
              <TextInput
                className="text-white text-center font-extrabold text-2xl tracking-[10px]"
                placeholder="000000"
                placeholderTextColor="#4B5563"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(val) => {
                  setOtp(val);
                  if (error) setError(null);
                }}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              onPress={handleVerifyOTP}
              disabled={otp.length !== 6 || loading || !confirmationResult}
              className={`w-full py-4 rounded-2xl items-center justify-center shadow-md ${
                otp.length === 6 && !loading && confirmationResult ? 'bg-indigo-600 shadow-indigo-500/30' : 'bg-gray-800 opacity-50'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white text-lg font-bold">Verify & Proceed</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Resend Code */}
          <View className="items-center mt-6">
            {timer > 0 ? (
              <Text className="text-gray-500 text-sm">
                Resend code in <Text className="text-indigo-400 font-bold">{timer}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResendOTP} disabled={loading}>
                <Text className="text-indigo-400 font-bold text-sm underline">Resend Verification Code</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
