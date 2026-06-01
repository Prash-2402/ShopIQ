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
import { useAddInventoryItem } from '../../hooks/useInventory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormErrors {
  name?: string;
  quantity?: string;
  costPrice?: string;
  sellPrice?: string;
  expiryDate?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPIRY_RE = /^\d{4}-\d{2}-\d{2}$/;

function validate(fields: {
  name: string;
  quantity: string;
  costPrice: string;
  sellPrice: string;
  expiryDate: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!fields.name.trim()) {
    errors.name = 'Product name is required';
  }

  const qty = parseFloat(fields.quantity);
  if (fields.quantity.trim() === '' || isNaN(qty) || qty < 0) {
    errors.quantity = 'Enter a valid non-negative quantity';
  }

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

interface FieldLabelProps {
  label: string;
}

const FieldLabel = ({ label }: FieldLabelProps) => (
  <Text className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">
    {label}
  </Text>
);

interface InlineErrorProps {
  message?: string;
}

const InlineError = ({ message }: InlineErrorProps) =>
  message ? (
    <Text className="text-red-400 text-xs mt-1 mb-2">{message}</Text>
  ) : null;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AddProductScreen() {
  const router = useRouter();
  const phone = useAuthStore((state) => state.phone) || '';
  const showToast = useToastStore((state) => state.showToast);
  const { mutate: addItem, isPending } = useAddInventoryItem();

  // Form state
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('units');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [expiryDate, setExpiryDate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSave = () => {
    const validationErrors = validate({ name, quantity, costPrice, sellPrice, expiryDate });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    addItem(
      {
        phone,
        item: {
          name: name.trim(),
          barcode: barcode.trim() || null,
          category: category.trim() || null,
          quantity: parseFloat(quantity),
          unit: unit.trim() || 'units',
          costPrice: parseFloat(costPrice),
          sellPrice: parseFloat(sellPrice),
          lowStockThreshold: parseInt(lowStockThreshold || '5', 10),
          expiryDate: expiryDate.trim() || null,
        },
      },
      {
        onSuccess: () => {
          showToast('Product added to inventory ✓', 'success');
          router.back();
        },
        onError: (err: Error) => {
          showToast(err.message || 'Could not save product. Try again.', 'error');
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
        <View className="flex-row items-center justify-between mb-8 mt-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-indigo-400 font-semibold text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Add Product</Text>
          {/* spacer — keeps title centred */}
          <View style={{ width: 60 }} />
        </View>

        {/* ── Form Card ────────────────────────────────────────────────── */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-6 mb-6">

          {/* 1. Product Name */}
          <FieldLabel label="Product Name *" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="e.g., Tata Salt 1kg"
            placeholderTextColor="#4B5563"
            value={name}
            onChangeText={setName}
            returnKeyType="next"
          />
          <InlineError message={errors.name} />

          {/* 2. Barcode */}
          <FieldLabel label="Barcode (Optional)" />
          <View className="flex-row items-center mb-4">
            <TextInput
              className="flex-1 bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold"
              placeholder="Scan or type barcode"
              placeholderTextColor="#4B5563"
              value={barcode}
              onChangeText={setBarcode}
              returnKeyType="next"
            />
            <TouchableOpacity
              onPress={() => router.push('/bill/scanner')}
              className="bg-[#1F2937] rounded-xl px-3 py-2 ml-2"
            >
              <Text className="text-white text-sm font-semibold">📷 Scan</Text>
            </TouchableOpacity>
          </View>

          {/* 3. Category */}
          <FieldLabel label="Category (Optional)" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="e.g., Dairy, Snacks, Staples"
            placeholderTextColor="#4B5563"
            value={category}
            onChangeText={setCategory}
            returnKeyType="next"
          />

          {/* 4. Quantity */}
          <FieldLabel label="Quantity *" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="0"
            placeholderTextColor="#4B5563"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            returnKeyType="next"
          />
          <InlineError message={errors.quantity} />

          {/* 5. Unit */}
          <FieldLabel label="Unit" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="units / kg / litre / dozen / packet"
            placeholderTextColor="#4B5563"
            value={unit}
            onChangeText={setUnit}
            returnKeyType="next"
          />

          {/* 6. Cost Price */}
          <FieldLabel label="Cost Price ₹ *" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="0"
            placeholderTextColor="#4B5563"
            value={costPrice}
            onChangeText={setCostPrice}
            keyboardType="numeric"
            returnKeyType="next"
          />
          <InlineError message={errors.costPrice} />

          {/* 7. Sell Price */}
          <FieldLabel label="Sell Price ₹ *" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="0"
            placeholderTextColor="#4B5563"
            value={sellPrice}
            onChangeText={setSellPrice}
            keyboardType="numeric"
            returnKeyType="next"
          />
          <InlineError message={errors.sellPrice} />

          {/* 8. Low Stock Alert */}
          <FieldLabel label="Low Stock Alert" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-1"
            placeholder="5"
            placeholderTextColor="#4B5563"
            value={lowStockThreshold}
            onChangeText={setLowStockThreshold}
            keyboardType="numeric"
            returnKeyType="next"
          />
          <Text className="text-gray-500 text-xs mt-1 mb-4">
            Alert fires when stock falls below this number
          </Text>

          {/* 9. Expiry Date */}
          <FieldLabel label="Expiry Date (Optional)" />
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-1"
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#4B5563"
            value={expiryDate}
            onChangeText={setExpiryDate}
            returnKeyType="done"
          />
          <Text className="text-gray-500 text-xs mt-1 mb-2">
            Leave blank if item has no expiry
          </Text>
          <InlineError message={errors.expiryDate} />
        </View>

        {/* ── Save Button ───────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isPending}
          className="bg-emerald-600 rounded-2xl py-4 items-center"
          style={{ opacity: isPending ? 0.7 : 1 }}
        >
          {isPending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text className="text-white font-bold text-base">Save Product</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
