import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Share, Vibration, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getBillById, LocalBill } from '../../services/supabase/billing';

export default function ReceiptSuccessScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [bill, setBill] = useState<LocalBill | null>(null);
  const [loading, setLoading] = useState(true);

  const checkScale = useRef(new Animated.Value(0.3)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

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

  useEffect(() => {
    if (!loading && bill) {
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.12,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [loading, bill]);

  const handleShareInvoice = async () => {
    if (!bill) return;

    Vibration.vibrate(50);

    const itemsText = bill.items
      .map((item) => `- ${item.name} (${item.quantity}x) : ₹${item.subtotal}`)
      .join('\n');

    const formattedInvoice = `
🧾 KIRANA STORE RECEIPT
--------------------------
Bill Number: ${bill.billNumber}
Date: ${new Date(bill.createdAt).toLocaleDateString()}
--------------------------
ITEMS:
${itemsText}
--------------------------
GRAND TOTAL: ₹${bill.total}
--------------------------
Thank you for shopping with us!
`;

    try {
      await Share.share({
        message: formattedInvoice,
      });
    } catch (error) {
      console.error('Error sharing receipt:', error);
    }
  };

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
          onPress={() => router.replace('/(tabs)')}
          className="bg-indigo-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Go to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]">
      <ScrollView className="flex-1 px-6 pt-10" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Animated Checkmark Header */}
        <View className="items-center mt-6 mb-8">
          <Animated.View 
            style={{ transform: [{ scale: pulseScale }] }}
            className="w-24 h-24 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-full items-center justify-center mb-6"
          >
            <Animated.View 
              style={{ transform: [{ scale: checkScale }] }}
              className="w-16 h-16 bg-emerald-500 rounded-full items-center justify-center shadow-lg shadow-emerald-500/30"
            >
              <Text className="text-white text-3xl font-bold">✓</Text>
            </Animated.View>
          </Animated.View>
          
          <Text className="text-white text-2xl font-black text-center tracking-tight">
            Bill Saved Successfully!
          </Text>
          {!bill.synced && (
            <Text className="text-amber-400 text-xs font-semibold text-center mt-1.5">
              Saved locally. Will sync automatically when online.
            </Text>
          )}
        </View>

        {/* Summary Card */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-6 mb-6 shadow-xl">
          <View className="flex-row justify-between items-center border-b border-gray-800/60 pb-4">
            <View>
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">Bill Number</Text>
              <Text className="text-white text-lg font-black mt-1">{bill.billNumber}</Text>
            </View>
            <View className="items-end">
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">Amount Paid</Text>
              <Text className="text-indigo-400 text-2xl font-black mt-1">₹{bill.total}</Text>
            </View>
          </View>

          <View className="pt-4 max-h-[180px]">
            <ScrollView nestedScrollEnabled={true}>
              {bill.items.map((item, idx) => (
                <View key={idx} className="flex-row justify-between items-center py-2 border-b border-gray-800/20 last:border-b-0">
                  <View className="flex-1 mr-4">
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="text-gray-500 text-xs mt-0.5">₹{item.price} × {item.quantity}</Text>
                  </View>
                  <Text className="text-white text-sm font-bold">₹{item.subtotal}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Actions */}
        <View className="mb-6">
          <TouchableOpacity 
            onPress={handleShareInvoice}
            className="w-full bg-indigo-600 py-4 rounded-2xl items-center justify-center flex-row shadow-lg shadow-indigo-500/20 mb-4"
          >
            <Text className="text-white font-extrabold text-base">📤 Share Receipt (WhatsApp)</Text>
          </TouchableOpacity>

          <View className="flex-row justify-between">
            <TouchableOpacity 
              onPress={() => router.replace('/bill/new')}
              className="bg-[#13192B] border border-gray-800 py-4 rounded-2xl flex-1 items-center justify-center mr-2 shadow-sm"
            >
              <Text className="text-white font-bold text-sm">🛒 New Bill</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.replace('/(tabs)/history')}
              className="bg-[#13192B] border border-gray-800 py-4 rounded-2xl flex-1 items-center justify-center ml-2 shadow-sm"
            >
              <Text className="text-white font-bold text-sm">📜 View History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
