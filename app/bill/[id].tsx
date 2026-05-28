import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getBillById, LocalBill } from '../../services/supabase/billing';

export default function BillDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [bill, setBill] = useState<LocalBill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBill = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const found = await getBillById(id);
        setBill(found);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadBill();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0E1A] items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  if (!bill) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0E1A] items-center justify-center p-6">
        <Text className="text-red-400 font-bold text-lg mb-4">Invoice Not Found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-indigo-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8 mt-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-indigo-400 font-semibold text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Invoice Details</Text>
          <View />
        </View>

        {/* Sync Status Badge Indicator */}
        <View className="items-center mb-6">
          {!bill.synced ? (
            <View className="bg-amber-950/60 border border-amber-900 px-4 py-2 rounded-2xl items-center flex-row">
              <View className="w-2 h-2 bg-amber-500 rounded-full mr-2.5 animate-pulse" />
              <Text className="text-amber-400 font-bold text-xs">LOCAL (PENDING SYNC)</Text>
            </View>
          ) : (
            <View className="bg-green-950/60 border border-green-900 px-4 py-2 rounded-2xl items-center flex-row">
              <View className="w-2 h-2 bg-green-500 rounded-full mr-2.5" />
              <Text className="text-green-400 font-bold text-xs">SUCCESSFULLY SYNCED ONLINE</Text>
            </View>
          )}
        </View>

        {/* Invoice Card Mockup */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-6 shadow-xl">
          <View className="border-b border-gray-800/80 pb-4 items-center">
            <Text className="text-white text-xl font-black">{bill.billNumber}</Text>
            <Text className="text-gray-400 text-xs mt-1.5">
              {new Date(bill.createdAt).toLocaleDateString(undefined, { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
            <Text className="text-gray-400 text-xs mt-0.5">
              {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View className="flex-row justify-between items-center py-3 border-b border-gray-800/40 mt-4">
            <Text className="text-gray-400 text-xs font-bold flex-[3]">ITEM</Text>
            <Text className="text-gray-400 text-xs font-bold flex-[1] text-center">QTY</Text>
            <Text className="text-gray-400 text-xs font-bold flex-[1.5] text-right">TOTAL</Text>
          </View>

          <View className="py-2 border-b border-gray-800/40">
            {bill.items.map((item, idx) => (
              <View key={idx} className="flex-row justify-between items-start py-3">
                <View className="flex-[3] mr-2">
                  <Text className="text-white font-semibold text-sm" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text className="text-gray-500 text-xs mt-0.5">₹{item.price} each</Text>
                </View>
                <Text className="text-white text-sm font-semibold flex-[1] text-center">
                  {item.quantity}
                </Text>
                <Text className="text-white text-sm font-bold flex-[1.5] text-right">
                  ₹{item.subtotal}
                </Text>
              </View>
            ))}
          </View>

          <View className="pt-4 border-b border-dashed border-gray-800/80 pb-4">
            <View className="flex-row justify-between items-center mb-2.5">
              <Text className="text-gray-400 text-sm">Subtotal</Text>
              <Text className="text-white text-sm font-semibold">₹{bill.total}</Text>
            </View>
            <View className="flex-row justify-between items-center mb-2.5">
              <Text className="text-gray-400 text-sm">GST (0%)</Text>
              <Text className="text-white text-sm font-semibold">₹0</Text>
            </View>
          </View>

          <View className="flex-row justify-between items-center pt-5">
            <Text className="text-white text-base font-extrabold">Grand Total</Text>
            <Text className="text-indigo-400 text-3xl font-black">₹{bill.total}</Text>
          </View>
        </View>

        <View className="mt-8 flex-row justify-between">
          <TouchableOpacity 
            className="flex-1 bg-[#13192B] border border-gray-800 rounded-2xl py-4 items-center justify-center mr-2"
            onPress={() => alert('Print feature placeholder')}
          >
            <Text className="text-white font-bold text-sm">🖨️ Print Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="flex-1 bg-indigo-600 rounded-2xl py-4 items-center justify-center ml-2"
            onPress={() => alert('Share feature placeholder')}
          >
            <Text className="text-white font-bold text-sm">📤 Share Invoice</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
