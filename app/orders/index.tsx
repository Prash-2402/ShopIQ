import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOnlineOrders, fulfillOrder, cancelOrder } from '../../services/supabase/onlineStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

export default function OrdersScreen() {
  const phone = useAuthStore(state => state.phone);
  const { showToast } = useToastStore();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['onlineOrders', phone],
    queryFn: () => getOnlineOrders(phone!),
    enabled: !!phone,
  });

  const fulfillMutation = useMutation({
    mutationFn: (id: string) => fulfillOrder(id),
    onSuccess: () => {
      showToast('Order marked as fulfilled', 'success');
      queryClient.invalidateQueries({ queryKey: ['onlineOrders'] });
    },
    onError: (err: any) => showToast(err.message || 'Error', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelOrder(id),
    onSuccess: () => {
      showToast('Order cancelled', 'success');
      queryClient.invalidateQueries({ queryKey: ['onlineOrders'] });
    },
    onError: (err: any) => showToast(err.message || 'Error', 'error'),
  });

  const handleCancel = (id: string) => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: () => cancelMutation.mutate(id) }
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mb-6 mt-4">
          <Text className="text-white text-3xl font-extrabold tracking-tight">Online Orders</Text>
          <Text className="text-gray-400 text-sm mt-1">Manage your mini-store incoming orders</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#6366F1" size="large" className="mt-10" />
        ) : orders.length === 0 ? (
          <View className="flex-1 justify-center items-center py-12">
            <Text className="text-3xl mb-3">🌐</Text>
            <Text className="text-gray-500 text-sm font-semibold text-center">No online orders yet</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-4 shadow-sm">
              <View className="flex-row justify-between items-start mb-3">
                <View>
                  <Text className="text-white font-bold text-base">{order.customerName}</Text>
                  <Text className="text-gray-400 text-xs mt-0.5">{order.customerPhone || 'No phone provided'}</Text>
                </View>
                <View className={`px-2 py-1 rounded-lg ${
                  order.status === 'pending' ? 'bg-amber-950 text-amber-400' :
                  order.status === 'fulfilled' ? 'bg-emerald-950 text-emerald-400' :
                  'bg-red-950 text-red-400'
                }`}>
                  <Text className={`text-[10px] font-bold uppercase tracking-wider ${
                    order.status === 'pending' ? 'text-amber-400' :
                    order.status === 'fulfilled' ? 'text-emerald-400' :
                    'text-red-400'
                  }`}>{order.status}</Text>
                </View>
              </View>

              <View className="bg-[#0F1424] rounded-xl p-3 mb-4">
                {order.items.map((item, idx) => (
                  <View key={idx} className="flex-row justify-between mb-1 last:mb-0">
                    <Text className="text-gray-300 text-sm" numberOfLines={1}>{item.quantity}x {item.name}</Text>
                    <Text className="text-gray-400 text-sm">₹{item.price * item.quantity}</Text>
                  </View>
                ))}
                <View className="border-t border-gray-800 mt-2 pt-2 flex-row justify-between">
                  <Text className="text-white font-bold">Total</Text>
                  <Text className="text-emerald-400 font-bold">₹{order.total}</Text>
                </View>
              </View>

              {order.status === 'pending' && (
                <View className="flex-row justify-between">
                  <TouchableOpacity
                    onPress={() => handleCancel(order.id)}
                    className="flex-1 bg-red-950/40 border border-red-900/60 py-3 rounded-xl items-center mr-2"
                  >
                    <Text className="text-red-400 font-bold text-sm">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => fulfillMutation.mutate(order.id)}
                    className="flex-1 bg-emerald-600 shadow-sm shadow-emerald-500/20 py-3 rounded-xl items-center ml-2"
                  >
                    <Text className="text-white font-bold text-sm">Mark Fulfilled</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
