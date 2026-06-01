import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import {
  useInventory,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
} from '../../hooks/useInventory';
import { InventoryItem } from '../../services/supabase/inventory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPIRY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

interface FormErrors {
  name?: string;
  costPrice?: string;
  sellPrice?: string;
  expiryDate?: string;
}

function validate(fields: {
  name: string;
  costPrice: string;
  sellPrice: string;
  expiryDate: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!fields.name.trim()) errors.name = 'Product name is required';

  const cost = parseFloat(fields.costPrice);
  if (fields.costPrice.trim() === '' || isNaN(cost) || cost < 0) {
    errors.costPrice = 'Enter a valid non-negative cost price';
  }

  const sell = parseFloat(fields.sellPrice);
  if (fields.sellPrice.trim() === '' || isNaN(sell) || sell < 0) {
    errors.sellPrice = 'Enter a valid non-negative sell price';
  }

  if (fields.expiryDate.trim() && !EXPIRY_RE.test(fields.expiryDate.trim())) {
    errors.expiryDate = 'Use format YYYY-MM-DD (e.g. 2025-12-31)';
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const FieldLabel = ({ label }: { label: string }) => (
  <Text className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">
    {label}
  </Text>
);

const InlineError = ({ message }: { message?: string }) =>
  message ? (
    <Text className="text-red-400 text-xs mt-1 mb-2">{message}</Text>
  ) : null;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function StockItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const phone = useAuthStore((state) => state.phone) || '';
  const showToast = useToastStore((state) => state.showToast);

  const { data: inventory = [], isLoading } = useInventory(phone);
  const { mutate: updateItem, isPending: isUpdating } = useUpdateInventoryItem();
  const { mutate: deleteItem, isPending: isDeleting } = useDeleteInventoryItem();

  // Find the item from the cached inventory list
  const item: InventoryItem | undefined = inventory.find((i) => i.id === id);

  // ── Edit form state ──────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState('units');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [expiryDate, setExpiryDate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // Populate form once item is available
  useEffect(() => {
    if (item) {
      setName(item.name);
      setBarcode(item.barcode ?? '');
      setCategory(item.category ?? '');
      setQuantity(item.quantity);
      setUnit(item.unit);
      setCostPrice(String(item.costPrice));
      setSellPrice(String(item.sellPrice));
      setLowStockThreshold(String(item.lowStockThreshold));
      setExpiryDate(item.expiryDate ?? '');
    }
  }, [item?.id]); // re-populate if the user navigates to a different item

  // ── Quick stock adjustment ───────────────────────────────────────────────
  const adjustStock = (delta: number) => {
    if (!item) return;
    const newQty = Math.max(0, quantity + delta);
    setQuantity(newQty);
    updateItem(
      { id: item.id, updates: { quantity: newQty } },
      {
        onSuccess: () => showToast(`Stock updated to ${newQty} ${item.unit}`, 'success'),
        onError: (err: Error) => showToast(err.message || 'Could not update stock.', 'error'),
      },
    );
  };

  // ── Save changes ─────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!item) return;

    const validationErrors = validate({ name, costPrice, sellPrice, expiryDate });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    updateItem(
      {
        id: item.id,
        updates: {
          name: name.trim(),
          barcode: barcode.trim() || null,
          category: category.trim() || null,
          unit: unit.trim() || 'units',
          costPrice: parseFloat(costPrice),
          sellPrice: parseFloat(sellPrice),
          lowStockThreshold: parseInt(lowStockThreshold || '5', 10),
          expiryDate: expiryDate.trim() || null,
        },
      },
      {
        onSuccess: () => showToast('Changes saved ✓', 'success'),
        onError: (err: Error) => showToast(err.message || 'Could not save changes.', 'error'),
      },
    );
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!item) return;

    Alert.alert(
      'Delete Product',
      `This will permanently remove ${item.name} from your inventory. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteItem(item.id, {
              onSuccess: () => {
                showToast(`${item.name} removed from inventory`, 'success');
                router.back();
              },
              onError: (err: Error) =>
                showToast(err.message || 'Could not delete item.', 'error'),
            });
          },
        },
      ],
    );
  };

  // ── Loading / not found states ────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-4xl mb-3">🔍</Text>
          <Text className="text-gray-500 text-sm font-semibold text-center">
            Product not found
          </Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-6">
            <Text className="text-indigo-400 font-semibold">← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isLow = quantity <= item.lowStockThreshold;
  const isExpiring = isExpiringWithin7Days(expiryDate || item.expiryDate);
  const isBusy = isUpdating || isDeleting;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between mb-6 mt-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-indigo-400 font-semibold text-lg">← Back</Text>
          </TouchableOpacity>
          <Text
            className="text-white text-xl font-bold flex-1 text-center mx-4"
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <TouchableOpacity onPress={handleDelete} disabled={isBusy}>
            <Text className="text-red-400 font-semibold text-sm">Delete</Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary Card ─────────────────────────────────────────────── */}
        <View className="bg-indigo-600 rounded-3xl p-6 mb-6">
          {/* Current stock row */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-indigo-200 text-sm font-semibold">Current Stock</Text>
            <Text className="text-white text-4xl font-extrabold">
              {quantity} {unit}
            </Text>
          </View>

          {/* Price row */}
          <Text className="text-indigo-200 text-sm font-semibold mb-3">
            Cost ₹{parseFloat(costPrice || '0').toLocaleString('en-IN')}
            {'   |   '}
            Sell ₹{parseFloat(sellPrice || '0').toLocaleString('en-IN')}
          </Text>

          {/* Badges */}
          <View className="flex-row gap-2">
            {isLow && (
              <View className="bg-red-600/80 px-3 py-1 rounded-xl">
                <Text className="text-white text-[10px] font-black">⚠️ LOW STOCK</Text>
              </View>
            )}
            {isExpiring && (
              <View className="bg-amber-500/80 px-3 py-1 rounded-xl">
                <Text className="text-white text-[10px] font-black">🕐 EXPIRING SOON</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Quick Stock Adjustment ────────────────────────────────────── */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6">
          <Text className="text-white font-bold text-base mb-3">Adjust Stock</Text>

          <View className="flex-row items-center">
            {/* -10 */}
            <TouchableOpacity
              onPress={() => adjustStock(-10)}
              disabled={isBusy}
              className="bg-red-950/40 border border-red-900/40 rounded-xl py-3 flex-1 mr-2 items-center"
            >
              <Text className="text-red-400 font-bold text-base">-10</Text>
            </TouchableOpacity>

            {/* -1 */}
            <TouchableOpacity
              onPress={() => adjustStock(-1)}
              disabled={isBusy}
              className="bg-red-950/40 border border-red-900/40 rounded-xl py-3 flex-1 mr-2 items-center"
            >
              <Text className="text-red-400 font-bold text-base">-1</Text>
            </TouchableOpacity>

            {/* Current quantity display */}
            <View className="items-center mx-2">
              {isBusy ? (
                <ActivityIndicator size="small" color="#6366F1" />
              ) : (
                <Text className="text-white font-extrabold text-2xl">{quantity}</Text>
              )}
            </View>

            {/* +1 */}
            <TouchableOpacity
              onPress={() => adjustStock(1)}
              disabled={isBusy}
              className="bg-emerald-950/40 border border-emerald-900/40 rounded-xl py-3 flex-1 ml-2 items-center"
            >
              <Text className="text-emerald-400 font-bold text-base">+1</Text>
            </TouchableOpacity>

            {/* +10 */}
            <TouchableOpacity
              onPress={() => adjustStock(10)}
              disabled={isBusy}
              className="bg-emerald-950/40 border border-emerald-900/40 rounded-xl py-3 flex-1 ml-2 items-center"
            >
              <Text className="text-emerald-400 font-bold text-base">+10</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Edit Form ────────────────────────────────────────────────── */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-6 mb-6">

          {/* Product Name */}
          <FieldLabel label="Product Name *" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="e.g., Tata Salt 1kg"
            placeholderTextColor="#4B5563"
            value={name}
            onChangeText={setName}
          />
          <InlineError message={errors.name} />

          {/* Barcode */}
          <FieldLabel label="Barcode (Optional)" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="Scan or type barcode"
            placeholderTextColor="#4B5563"
            value={barcode}
            onChangeText={setBarcode}
          />

          {/* Category */}
          <FieldLabel label="Category (Optional)" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="e.g., Dairy, Snacks, Staples"
            placeholderTextColor="#4B5563"
            value={category}
            onChangeText={setCategory}
          />

          {/* Unit */}
          <FieldLabel label="Unit" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="units / kg / litre / dozen / packet"
            placeholderTextColor="#4B5563"
            value={unit}
            onChangeText={setUnit}
          />

          {/* Cost Price */}
          <FieldLabel label="Cost Price ₹ *" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="0"
            placeholderTextColor="#4B5563"
            value={costPrice}
            onChangeText={setCostPrice}
            keyboardType="numeric"
          />
          <InlineError message={errors.costPrice} />

          {/* Sell Price */}
          <FieldLabel label="Sell Price ₹ *" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="0"
            placeholderTextColor="#4B5563"
            value={sellPrice}
            onChangeText={setSellPrice}
            keyboardType="numeric"
          />
          <InlineError message={errors.sellPrice} />

          {/* Low Stock Threshold */}
          <FieldLabel label="Low Stock Alert" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-1"
            placeholder="5"
            placeholderTextColor="#4B5563"
            value={lowStockThreshold}
            onChangeText={setLowStockThreshold}
            keyboardType="numeric"
          />
          <Text className="text-gray-500 text-xs mt-1 mb-4">
            Alert fires when stock falls below this number
          </Text>

          {/* Expiry Date */}
          <FieldLabel label="Expiry Date (Optional)" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-1"
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#4B5563"
            value={expiryDate}
            onChangeText={setExpiryDate}
          />
          <Text className="text-gray-500 text-xs mt-1 mb-2">
            Leave blank if item has no expiry
          </Text>
          <InlineError message={errors.expiryDate} />
        </View>

        {/* ── Save Button ───────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isBusy}
          className="bg-indigo-600 rounded-2xl py-4 items-center"
          style={{ opacity: isBusy ? 0.7 : 1 }}
        >
          {isUpdating ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text className="text-white font-bold text-base">Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
