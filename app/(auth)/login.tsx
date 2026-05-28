import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { sendOTP, isFirebaseConfigured } from '../../services/firebase/auth';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref passed to Firebase signInWithPhoneNumber for reCAPTCHA app verification.
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const setConfirmationResult = useAuthStore((state) => state.setConfirmationResult);

  const handleSendOTP = async () => {
    if (phone.length !== 10) return;
    setLoading(true);
    setError(null);

    try {
      // Pass the reCAPTCHA verifier when Firebase is fully configured.
      // In simulation mode (no Firebase keys) sendOTP ignores the verifier.
      const verifier = isFirebaseConfigured()
        ? recaptchaVerifier.current ?? undefined
        : undefined;

      const confirmation = await sendOTP(phone, verifier);
      setConfirmationResult(confirmation);

      router.push({
        pathname: '/(auth)/otp',
        params: { phone },
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Firebase config read from app.json "extra" — keeps it in one place.
  const firebaseConfig = Constants.expoConfig?.extra?.firebase;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#0A0E1A]"
    >
      {/*
        FirebaseRecaptchaVerifierModal is rendered invisibly at root level.
        attemptInvisibleVerification tries the invisible flow first;
        if Google needs extra verification it briefly shows the modal.
        Only mounted when Firebase keys are present.
      */}
      {isFirebaseConfigured() && firebaseConfig && (
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={firebaseConfig}
          attemptInvisibleVerification
        />
      )}

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-between px-6 pt-24 pb-12">

          {/* Header / Hero */}
          <View className="items-center mt-8">
            <View className="w-20 h-20 bg-indigo-600 rounded-2xl items-center justify-center shadow-lg shadow-indigo-500/50 mb-6">
              <Text className="text-white text-3xl font-bold">🎯</Text>
            </View>
            <Text className="text-white text-3xl font-extrabold tracking-tight text-center">
              KIRANA <Text className="text-indigo-400">AI</Text>
            </Text>
            <Text className="text-gray-400 text-base mt-2 text-center">
              Ultra-fast smart billing for Indian Kirana stores
            </Text>

            {!isFirebaseConfigured() && (
              <View className="bg-indigo-950/40 border border-indigo-900/60 rounded-xl px-4 py-2 mt-4">
                <Text className="text-indigo-300 text-xs font-semibold text-center">
                  💡 Running in Local Auth Simulation Mode (Mock OTP: 123456)
                </Text>
              </View>
            )}
          </View>

          {/* Form */}
          <View className="w-full bg-[#13192B] border border-gray-800 rounded-3xl p-6 shadow-xl">
            <Text className="text-white text-xl font-bold mb-2">Get Started</Text>
            <Text className="text-gray-400 text-sm mb-6">
              Enter your mobile number to receive a 6-digit OTP
            </Text>

            {error && (
              <View className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4 mb-4">
                <Text className="text-red-400 text-sm font-semibold">{error}</Text>
              </View>
            )}

            <View className="flex-row items-center bg-[#0F1424] border border-gray-800 rounded-2xl px-4 py-4 mb-6">
              <Text className="text-gray-400 font-semibold mr-3">+91</Text>
              <TextInput
                className="flex-1 text-white font-semibold text-lg"
                placeholder="98765 43210"
                placeholderTextColor="#4B5563"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(val) => {
                  setPhone(val);
                  if (error) setError(null);
                }}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              onPress={handleSendOTP}
              disabled={phone.length !== 10 || loading}
              className={`w-full py-4 rounded-2xl items-center justify-center shadow-md ${
                phone.length === 10 && !loading
                  ? 'bg-indigo-600 shadow-indigo-500/30'
                  : 'bg-gray-800 opacity-50'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white text-lg font-bold">Send OTP Verification</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="items-center mt-6">
            <Text className="text-gray-500 text-xs text-center">
              By proceeding, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
