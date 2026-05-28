import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { getBillsHistory, LocalBill } from '../../services/supabase/billing';
import { FlashList } from '@shopify/flash-list';

const FlashListCast = FlashList as any;

export default function HistoryScreen() {
  const router = useRouter();
  const phone = useAuthStore((state) => state.phone) || '';

  const [bills, setBills] = useState<LocalBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadHistory = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      const history = await getBillsHistory(phone);
      setBills(history);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory(false);
  };

  const filteredBills = bills.filter((bill) => 
    bill.billNumber.toLowerCase().includes(search.toLowerCase()) ||
    bill.items.some((i) => i.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]">
      <View className="flex-1 px-6 pt-6">
        {/* Header */}
        <View className="mb-6 mt-4">
          <Text className="text-white text-3xl font-extrabold tracking-tight">Bill History</Text>
          <Text className="text-gray-400 text-sm mt-1">Review all your previous transactions</Text>
        </View>

        {/* Search Bar */}
        <View className="bg-[#13192B] border border-gray-800 rounded-2xl px-4 py-3 flex-row items-center mb-6">
          <Text className="text-gray-500 mr-2 text-lg">🔍</Text>
          <TextInput
            className="flex-1 text-white text-base font-semibold"
            placeholder="Search by Bill ID or Product Name..."
            placeholderTextColor="#4B5563"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Bills List */}
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {filteredBills.length > 0 ? (
              <FlashListCast
                data={filteredBills}
                keyExtractor={(item: any) => item.id}
                estimatedItemSize={120}
                refreshing={refreshing}
                onRefresh={onRefresh}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: bill }: { item: any }) => (
                  <TouchableOpacity
                    onPress={() => router.push(`/bill/${bill.id}`)}
                    className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-4 flex-row justify-between items-center shadow-sm"
                  >
                    <View className="flex-1 mr-4">
                      <View className="flex-row items-center">
                        <Text className="text-white font-extrabold text-lg mr-2">{bill.billNumber}</Text>
                        {!bill.synced ? (
                          <View className="bg-amber-950 border border-amber-900 px-2 py-0.5 rounded-md">
                            <Text className="text-amber-400 text-[9px] font-black uppercase">PENDING SYNC</Text>
                          </View>
                        ) : (
                          <View className="bg-green-950 border border-green-900 px-2 py-0.5 rounded-md">
                            <Text className="text-green-400 text-[9px] font-black uppercase">SYNCED</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-gray-400 text-xs mt-2">
                        {new Date(bill.createdAt).toLocaleDateString()} at{' '}
                        {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text className="text-gray-400 text-sm mt-1">
                        {bill.items.length} Item{bill.items.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-white font-extrabold text-xl">₹{bill.total}</Text>
                      <Text className="text-indigo-400 text-xs font-semibold mt-1.5">View Invoice →</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View className="items-center justify-center py-12">
                <Text className="text-4xl mb-4">📭</Text>
                <Text className="text-gray-400 text-base font-semibold">No bills found matching search</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
