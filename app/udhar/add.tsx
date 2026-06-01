import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useAddCustomer } from '../../hooks/useUdhar';

export default function AddCustomerScreen() {
  const router = useRouter();
  const phone = useAuthStore((state) => state.phone) || '';
  const showToast = useToastStore((state) => state.showToast);
  const { mutate: addCustomer, isPending } = useAddCustomer();

  const [name, setName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [nameError, setNameError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setNameError('Customer name is required');
      return;
    }
    setNameError('');

    addCustomer(
      {
        phone,
        name: name.trim(),
        customerPhone: customerPhone.trim() || null,
      },
      {
        onSuccess: () => {
          showToast(`${name.trim()} added to udhar ledger`, 'success');
          router.back();
        },
        onError: (err: Error) => {
          showToast(err.message || 'Could not add customer. Try again.', 'error');
        },
      },
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between mt-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-indigo-400 font-semibold text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Add Customer</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* ── Form Card ────────────────────────────────────────────────── */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-6 mt-6">
          <Text className="text-white text-xl font-bold mb-1">Customer Details</Text>
          <Text className="text-gray-400 text-sm mb-6">
            Add a customer to start tracking udhar
          </Text>

          {/* Field 1 — Customer Name */}
          <Text className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">
            Customer Name
          </Text>
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold"
            placeholder="e.g., Ramesh Kumar"
            placeholderTextColor="#4B5563"
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (nameError) setNameError('');
            }}
            returnKeyType="next"
          />
          {nameError ? (
            <Text className="text-red-400 text-xs mt-1 mb-2">{nameError}</Text>
          ) : (
            <View className="mb-4" />
          )}

          {/* Field 2 — Phone Number */}
          <Text className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">
            Phone Number (Optional)
          </Text>
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-1"
            placeholder="10-digit mobile number"
            placeholderTextColor="#4B5563"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
            maxLength={10}
            returnKeyType="done"
          />
          <Text className="text-gray-500 text-xs mt-1">
            Used for WhatsApp reminders
          </Text>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isPending}
            className="bg-indigo-600 rounded-2xl py-4 w-full mt-6 items-center"
            style={{ opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-bold text-base">Add Customer</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
