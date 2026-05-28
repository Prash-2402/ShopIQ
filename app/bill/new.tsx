import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useBillStore } from '../../store/billStore';
import { useAuthStore } from '../../store/authStore';
import { createBill } from '../../services/supabase/billing';
import { getLocalCache, CachedProduct } from '../../services/supabase/products';

export default function NewBillScreen() {
  const router = useRouter();
  const { items, addItem, updateQuantity, removeItem, clearBill, total } = useBillStore();
  const { phone } = useAuthStore();
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [cachedProducts, setCachedProducts] = useState<CachedProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<CachedProduct[]>([]);

  useEffect(() => {
    const loadCache = async () => {
      const cache = await getLocalCache();
      setCachedProducts(cache);
    };
    loadCache();
  }, []);

  const handleNameChange = (text: string) => {
    setManualName(text);
    if (text.length >= 2) {
      const filtered = cachedProducts.filter((p) =>
        p.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  };

  const handleSelectProduct = (product: CachedProduct) => {
    setManualName(product.name);
    setManualPrice(product.price.toString());
    setFilteredProducts([]);
  };

  const handleAddManualItem = () => {
    if (manualName && manualPrice) {
      addItem({
        id: Math.random().toString(36).substring(7),
        name: manualName,
        price: parseFloat(manualPrice),
        quantity: 1,
      });
      setManualName('');
      setManualPrice('');
      setFilteredProducts([]);
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!phone) throw new Error('You must be logged in to create a bill.');
      if (items.length === 0) throw new Error('No items in the cart.');
      
      const billData = items.map((i) => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        barcode: i.id.startsWith('mock') ? undefined : i.id,
      }));
      
      return await createBill(phone, billData, total);
    },
    onSuccess: (savedBill) => {
      clearBill();
      router.replace(`/bill/success?id=${savedBill.id}`);
    },
    onError: (error: any) => {
      Alert.alert('Checkout Error', error.message || 'Failed to save bill. Please try again.');
    },
  });

  const handleSaveBill = () => {
    if (items.length > 0) {
      checkoutMutation.mutate();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]">
      <View className="flex-1 px-6 pt-6">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6 mt-4">
          <TouchableOpacity onPress={() => router.back()} disabled={checkoutMutation.isPending}>
            <Text className="text-indigo-400 font-semibold text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">New Bill</Text>
          <TouchableOpacity onPress={clearBill} disabled={checkoutMutation.isPending}>
            <Text className="text-red-400 font-semibold text-sm">Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Scan Actions */}
        <View className="flex-row justify-between mb-6">
          <TouchableOpacity
            onPress={() => router.push('/bill/scanner')}
            disabled={checkoutMutation.isPending}
            className="flex-1 bg-indigo-600 rounded-2xl py-4 items-center justify-center flex-row shadow-md shadow-indigo-500/20 mr-2"
          >
            <Text className="text-xl mr-2">📷</Text>
            <Text className="text-white font-extrabold text-sm">Scan Barcode / AI</Text>
          </TouchableOpacity>
        </View>

        {/* Items List */}
        <Text className="text-white text-lg font-bold mb-3">Items ({items.length})</Text>
        <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
          {items.length > 0 ? (
            items.map((item) => (
              <View key={item.id} className="bg-[#13192B] border border-gray-800 rounded-2xl p-4 mb-3 flex-row justify-between items-center">
                <View className="flex-1 mr-4">
                  <Text className="text-white font-bold text-base" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-indigo-400 text-xs font-semibold mt-1">₹{item.price} each</Text>
                  <Text className="text-white font-semibold text-sm mt-1.5">Subtotal: ₹{item.price * item.quantity}</Text>
                </View>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => updateQuantity(item.id, item.quantity - 1)}
                    disabled={checkoutMutation.isPending}
                    className="w-8 h-8 bg-gray-800 rounded-xl items-center justify-center"
                  >
                    <Text className="text-white font-bold text-lg">-</Text>
                  </TouchableOpacity>
                  <Text className="text-white font-bold text-base mx-3">{item.quantity}</Text>
                  <TouchableOpacity
                    onPress={() => updateQuantity(item.id, item.quantity + 1)}
                    disabled={checkoutMutation.isPending}
                    className="w-8 h-8 bg-gray-800 rounded-xl items-center justify-center"
                  >
                    <Text className="text-white font-bold text-lg">+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeItem(item.id)}
                    disabled={checkoutMutation.isPending}
                    className="w-8 h-8 bg-red-950/40 rounded-xl items-center justify-center ml-3"
                  >
                    <Text className="text-red-400 font-bold text-sm">✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View className="items-center justify-center py-12 bg-[#13192B]/30 border border-dashed border-gray-800 rounded-3xl">
              <Text className="text-4xl mb-3">🛒</Text>
              <Text className="text-gray-400 text-sm font-semibold">No items in the bill yet</Text>
            </View>
          )}
        </ScrollView>

        {/* Manual Add Input */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-4 mb-4">
          <Text className="text-white font-bold text-sm mb-3">Quick Add Manual Item</Text>
          <View className="flex-row mb-3">
            <TextInput
              className="flex-[2] bg-[#0F1424] border border-gray-800 text-white rounded-xl px-3 py-2 text-sm mr-2 font-semibold"
              placeholder="Product Name"
              placeholderTextColor="#4B5563"
              value={manualName}
              onChangeText={handleNameChange}
              editable={!checkoutMutation.isPending}
            />
            <TextInput
              className="flex-[1] bg-[#0F1424] border border-gray-800 text-white rounded-xl px-3 py-2 text-sm font-semibold"
              placeholder="Price"
              placeholderTextColor="#4B5563"
              keyboardType="numeric"
              value={manualPrice}
              onChangeText={setManualPrice}
              editable={!checkoutMutation.isPending}
            />
          </View>
          {/* Autocomplete suggestions */}
          {filteredProducts.length > 0 && (
            <View className="bg-[#0F1424] border border-gray-800 rounded-xl mb-3 max-h-36 overflow-hidden">
              <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                {filteredProducts.map((p) => (
                  <TouchableOpacity
                    key={p.barcode}
                    onPress={() => handleSelectProduct(p)}
                    className="px-4 py-2.5 border-b border-gray-900 flex-row justify-between items-center"
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-white font-bold text-xs" numberOfLines={1}>{p.name}</Text>
                      <Text className="text-indigo-400 text-[10px] font-semibold">{p.category || 'General'}</Text>
                    </View>
                    <Text className="text-emerald-400 font-bold text-xs">₹{p.price}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <TouchableOpacity
            onPress={handleAddManualItem}
            disabled={checkoutMutation.isPending}
            className="w-full bg-[#1F2937] py-2.5 rounded-xl items-center justify-center"
          >
            <Text className="text-indigo-400 font-bold text-sm">Add Item</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Billing Total & Save */}
        <View className="bg-[#13192B] border border-gray-800 rounded-t-3xl p-5 -mx-6 pb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-gray-400 text-base font-semibold">Total Amount:</Text>
            <Text className="text-white text-3xl font-black">₹{total}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSaveBill}
            disabled={items.length === 0 || checkoutMutation.isPending}
            className={`w-full py-4 rounded-2xl items-center justify-center shadow-md ${
              items.length > 0 && !checkoutMutation.isPending ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-gray-800 opacity-50'
            }`}
          >
            {checkoutMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-lg font-bold">Complete & Save Bill</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
