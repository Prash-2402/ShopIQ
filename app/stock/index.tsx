import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useAuthStore } from '../../store/authStore';
import { useInventory, useLowStockItems, useExpiringItems } from '../../hooks/useInventory';
import { InventoryItem } from '../../services/supabase/inventory';

// FlashList cast — required because FlashList generic typing conflicts with
// the JSX element type expected by React Native's component system.
const FlashListCast = FlashList as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExpiringWithin7Days(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 7);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return expiry >= today && expiry <= cutoff;
}

// ---------------------------------------------------------------------------
// Item card
// ---------------------------------------------------------------------------

interface InventoryCardProps {
  item: InventoryItem;
  onPress: (id: string) => void;
}

const InventoryCard = React.memo(({ item, onPress }: InventoryCardProps) => {
  const isLow = item.quantity <= item.lowStockThreshold;
  const isExpiring = isExpiringWithin7Days(item.expiryDate);

  return (
    <TouchableOpacity
      onPress={() => onPress(item.id)}
      className="bg-[#13192B] border border-gray-800 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
    >
      {/* Left */}
      <View className="flex-1 mr-3">
        <Text className="text-white font-bold text-base" numberOfLines={1}>
          {item.name}
        </Text>
        {item.category ? (
          <Text className="text-gray-400 text-xs mt-0.5">{item.category}</Text>
        ) : null}
        <Text className="text-gray-500 text-xs mt-1">
          ₹{item.costPrice.toLocaleString('en-IN')} cost{'  •  '}₹{item.sellPrice.toLocaleString('en-IN')} sell
        </Text>
      </View>

      {/* Right */}
      <View className="items-end">
        <Text className="text-white font-extrabold text-xl">
          {item.quantity} {item.unit}
        </Text>
        {isLow ? (
          <View className="bg-red-950 px-2 py-0.5 rounded mt-1">
            <Text className="text-red-400 text-[9px] font-black">LOW STOCK</Text>
          </View>
        ) : null}
        {isExpiring ? (
          <View className="bg-amber-950 px-2 py-0.5 rounded mt-1">
            <Text className="text-amber-400 text-[9px] font-black">EXPIRING</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function StockScreen() {
  const router = useRouter();
  const phone = useAuthStore((state) => state.phone) || '';

  const { data: inventory = [], isLoading, refetch } = useInventory(phone);
  const { data: lowStockItems = [] } = useLowStockItems(phone);
  const { data: expiringItems = [] } = useExpiringItems(phone);

  const handleItemPress = useCallback(
    (id: string) => router.push(`/stock/${id}`),
    [router],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View className="flex-row justify-between items-start mb-6 mt-4">
          <View className="flex-1 mr-4">
            <Text className="text-white text-3xl font-extrabold tracking-tight">
              Stock Inventory
            </Text>
            <Text className="text-gray-400 text-sm mt-1">
              Manage products and track levels
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => refetch()}
            className="bg-[#13192B] border border-gray-800 rounded-full w-12 h-12 items-center justify-center"
          >
            <Text style={{ fontSize: 20 }}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* ── Low Stock Banner ─────────────────────────────────────────── */}
        {lowStockItems.length > 0 ? (
          <View className="bg-red-950/40 border border-red-900/60 rounded-3xl p-5 mb-6">
            <Text className="text-red-400 font-extrabold text-sm mb-1">
              ⚠️ {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} running low
            </Text>
            <Text className="text-gray-400 text-xs">
              {lowStockItems
                .slice(0, 3)
                .map((i) => i.name)
                .join(' • ')}
            </Text>
          </View>
        ) : null}

        {/* ── Expiry Banner ────────────────────────────────────────────── */}
        {expiringItems.length > 0 ? (
          <View className="bg-amber-950/40 border border-amber-900/60 rounded-3xl p-5 mb-6">
            <Text className="text-amber-400 font-extrabold text-sm">
              🕐 {expiringItems.length} item{expiringItems.length > 1 ? 's' : ''} expiring within 7 days
            </Text>
          </View>
        ) : null}

        {/* ── Add New Item CTA ─────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/stock/add')}
          className="bg-indigo-600 rounded-2xl py-4 mb-6 items-center"
        >
          <Text className="text-white font-extrabold text-base">＋ Add New Product</Text>
        </TouchableOpacity>

        {/* ── Inventory List ───────────────────────────────────────────── */}
        <Text className="text-white text-lg font-bold mb-4">
          All Products ({inventory.length})
        </Text>

        {isLoading ? (
          <View className="flex-1 justify-center items-center py-16">
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : inventory.length === 0 ? (
          <View className="flex-1 justify-center items-center py-12">
            <Text className="text-4xl mb-3">📦</Text>
            <Text className="text-gray-500 text-sm font-semibold text-center">
              No products added yet
            </Text>
            <Text className="text-gray-600 text-xs mt-1 text-center">
              Add your first product to start tracking stock
            </Text>
          </View>
        ) : (
          /* FlashList requires a fixed height container when used inside ScrollView.
             We set a min-height based on item count so the list renders fully without
             a nested scroll conflict. estimatedItemSize matches the card height (88px). */
          <View style={{ minHeight: inventory.length * 88 }}>
            <FlashListCast
              data={inventory}
              keyExtractor={(item: InventoryItem) => item.id}
              estimatedItemSize={88}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }: { item: InventoryItem }) => (
                <InventoryCard item={item} onPress={handleItemPress} />
              )}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
