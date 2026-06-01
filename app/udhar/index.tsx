import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useAuthStore } from '../../store/authStore';
import { useCustomers } from '../../hooks/useUdhar';
import { Customer } from '../../services/supabase/udhar';

// FlashList cast — same pattern as history.tsx and analytics.tsx.
const FlashListCast = FlashList as any;

// ---------------------------------------------------------------------------
// Customer card
// ---------------------------------------------------------------------------

interface CustomerCardProps {
  customer: Customer;
  onPress: (id: string) => void;
}

const CustomerCard = React.memo(({ customer, onPress }: CustomerCardProps) => {
  const isInactive = customer.daysSinceActivity > 14;
  const isPaid = customer.balance <= 0;

  return (
    <TouchableOpacity
      onPress={() => onPress(customer.id)}
      className="bg-[#13192B] border border-gray-800 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
    >
      {/* Left */}
      <View className="flex-1 mr-3">
        <View className="flex-row items-center">
          <Text className="text-white font-bold text-base" numberOfLines={1}>
            {customer.name}
          </Text>
          {isInactive ? (
            <View className="bg-amber-950 px-2 py-0.5 rounded ml-2">
              <Text className="text-amber-400 text-[9px] font-black">INACTIVE</Text>
            </View>
          ) : null}
        </View>
        {customer.phone ? (
          <Text className="text-gray-400 text-xs mt-0.5">{customer.phone}</Text>
        ) : null}
        <Text className="text-gray-500 text-xs mt-1">
          Last activity:{' '}
          {customer.daysSinceActivity === 0
            ? 'today'
            : `${customer.daysSinceActivity} day(s) ago`}
        </Text>
      </View>

      {/* Right */}
      <View className="items-end">
        <Text
          className={`font-extrabold text-xl ${isPaid ? 'text-emerald-400' : 'text-red-400'}`}
        >
          ₹{customer.balance.toLocaleString('en-IN')}
        </Text>
        <Text
          className={`text-[9px] font-black mt-0.5 ${isPaid ? 'text-emerald-500' : 'text-red-500'}`}
        >
          {isPaid ? 'CLEAR' : 'OWES'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function UdharScreen() {
  const router = useRouter();
  const phone = useAuthStore((state) => state.phone) || '';
  const [search, setSearch] = useState('');

  const { data: customers = [], isLoading, refetch } = useCustomers(phone);

  const filteredCustomers = useMemo(
    () =>
      customers.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [customers, search],
  );

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0),
    [customers],
  );

  const handleCardPress = useCallback(
    (id: string) => router.push(`/udhar/${id}`),
    [router],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
      <View className="flex-1 px-6 pt-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View className="flex-row justify-between items-start mb-6 mt-4">
          <View className="flex-1 mr-4">
            <Text className="text-white text-3xl font-extrabold tracking-tight">
              Udhar Ledger
            </Text>
            <Text className="text-gray-400 text-sm mt-1">
              Customer credit and repayment tracking
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/udhar/add')}
            className="bg-indigo-600 rounded-xl px-4 py-2"
          >
            <Text className="text-white font-bold text-sm">＋ Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary Banner ──────────────────────────────────────────── */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6">
          <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
            Total Outstanding
          </Text>
          <Text className="text-white text-3xl font-extrabold mt-1">
            ₹{totalOutstanding.toLocaleString('en-IN')}
          </Text>
          <Text className="text-gray-400 text-sm mt-1">
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <View className="bg-[#13192B] border border-gray-800 rounded-2xl px-4 py-3 flex-row items-center mb-4">
          <Text className="text-gray-500 mr-2 text-lg">🔍</Text>
          <TextInput
            className="flex-1 text-white text-base font-semibold"
            placeholder="Search by customer name..."
            placeholderTextColor="#4B5563"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* ── Customer List ───────────────────────────────────────────── */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : filteredCustomers.length === 0 ? (
          <View className="flex-1 justify-center items-center py-12">
            <Text className="text-4xl mb-3">🤝</Text>
            <Text className="text-gray-500 text-sm font-semibold text-center">
              {search ? 'No customers match your search' : 'No customers yet'}
            </Text>
            {!search ? (
              <Text className="text-gray-600 text-xs mt-1 text-center">
                Add your first customer to start tracking udhar
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlashListCast
              data={filteredCustomers}
              keyExtractor={(item: Customer) => item.id}
              estimatedItemSize={90}
              refreshing={false}
              onRefresh={refetch}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }: { item: Customer }) => (
                <CustomerCard customer={item} onPress={handleCardPress} />
              )}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
