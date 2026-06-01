import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useToastStore } from '../../store/toastStore';
import {
  useCustomer,
  useTransactionHistory,
  useAddUdharEntry,
  useDeleteCustomer,
} from '../../hooks/useUdhar';
import { UdharTransaction } from '../../services/supabase/udhar';

// FlashList cast — same pattern as other list screens.
const FlashListCast = FlashList as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Transaction row
// ---------------------------------------------------------------------------

const TransactionRow = React.memo(({ item }: { item: UdharTransaction }) => {
  const isCredit = item.type === 'credit';
  return (
    <View className="bg-[#13192B] border border-gray-800 rounded-2xl p-4 mb-3 flex-row items-center">
      {/* Icon */}
      <View
        className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
          isCredit ? 'bg-red-950/40' : 'bg-emerald-950/40'
        }`}
      >
        <Text style={{ fontSize: 18 }}>{isCredit ? '💸' : '✅'}</Text>
      </View>

      {/* Middle */}
      <View className="flex-1">
        <Text className="text-white font-semibold text-sm">
          {isCredit ? 'Udhar Given' : 'Payment Received'}
        </Text>
        {item.note ? (
          <Text className="text-gray-400 text-xs mt-0.5">{item.note}</Text>
        ) : null}
        <Text className="text-gray-500 text-xs mt-0.5">{formatDate(item.createdAt)}</Text>
      </View>

      {/* Amount */}
      <Text
        className={`font-extrabold text-base ${isCredit ? 'text-red-400' : 'text-emerald-400'}`}
      >
        {isCredit ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CustomerLedgerScreen() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const showToast = useToastStore((state) => state.showToast);

  const { data: customer, isLoading: customerLoading } = useCustomer(customerId);
  const { data: transactions = [], isLoading: txLoading } = useTransactionHistory(customerId);
  const { mutate: addEntry, isPending: isSaving } = useAddUdharEntry();
  const { mutate: deleteCust, isPending: isDeleting } = useDeleteCustomer();

  // Entry form state
  const [entryType, setEntryType] = useState<'credit' | 'repayment'>('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  // ── WhatsApp reminder ────────────────────────────────────────────────────
  const handleWhatsApp = useCallback(() => {
    if (!customer?.phone) return;
    const text = encodeURIComponent(
      `Namaste ${customer.name}ji, aapka udhar baaki hai ₹${customer.balance}. Kripya jaldi chukta karein. Shukriya!`,
    );
    Linking.openURL(`https://wa.me/91${customer.phone}?text=${text}`);
  }, [customer]);

  // ── Save entry ───────────────────────────────────────────────────────────
  const handleSaveEntry = () => {
    const parsed = parseFloat(amount);
    if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
      showToast('Enter a valid amount greater than zero.', 'error');
      return;
    }

    addEntry(
      {
        customerId,
        amount: parsed,
        type: entryType,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          showToast('Transaction recorded ✓', 'success');
          setAmount('');
          setNote('');
        },
        onError: (err: Error) => {
          showToast(err.message || 'Could not save transaction.', 'error');
        },
      },
    );
  };

  // ── Delete customer ──────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!customer) return;
    Alert.alert(
      'Delete Customer',
      `This will permanently delete ${customer.name} and all their transaction history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCust(customer.id, {
              onSuccess: () => {
                showToast(`${customer.name} deleted`, 'success');
                router.back();
              },
              onError: (err: Error) =>
                showToast(err.message || 'Could not delete customer.', 'error'),
            });
          },
        },
      ],
    );
  }, [customer, deleteCust, showToast, router]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (customerLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-4xl mb-3">🔍</Text>
          <Text className="text-gray-500 text-sm font-semibold text-center">
            Customer not found
          </Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-6">
            <Text className="text-indigo-400 font-semibold">← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isPaid = customer.balance <= 0;
  const isBusy = isSaving || isDeleting;

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
            {customer.name}
          </Text>
          <TouchableOpacity onPress={handleDelete} disabled={isBusy}>
            <Text className="text-red-400 font-semibold text-sm">Delete</Text>
          </TouchableOpacity>
        </View>

        {/* ── Balance Hero Card ─────────────────────────────────────────── */}
        <View className="bg-[#13192B] border border-indigo-900/40 rounded-3xl p-6 mb-6">
          <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
            Outstanding Balance
          </Text>
          <Text
            className={`text-5xl font-extrabold mt-1 ${isPaid ? 'text-emerald-400' : 'text-red-400'}`}
          >
            ₹{customer.balance.toLocaleString('en-IN')}
          </Text>
          {customer.phone ? (
            <Text className="text-gray-400 text-sm mt-2">📱 {customer.phone}</Text>
          ) : null}
          <Text className="text-gray-500 text-xs mt-1">
            Last activity:{' '}
            {customer.daysSinceActivity === 0
              ? 'today'
              : `${customer.daysSinceActivity} day(s) ago`}
          </Text>
        </View>

        {/* ── WhatsApp Reminder ─────────────────────────────────────────── */}
        {customer.phone && !isPaid ? (
          <TouchableOpacity
            onPress={handleWhatsApp}
            className="bg-emerald-600 rounded-2xl py-3 px-5 flex-row items-center justify-center mb-6"
          >
            <Text className="text-white font-extrabold text-sm">
              💬 Send WhatsApp Reminder
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* ── Record Entry ──────────────────────────────────────────────── */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6">
          <Text className="text-white font-bold text-base mb-3">Record Transaction</Text>

          {/* Type toggle */}
          <View className="flex-row mb-4">
            <TouchableOpacity
              onPress={() => setEntryType('credit')}
              className="flex-1 rounded-xl py-3 items-center mr-2"
              style={{ backgroundColor: entryType === 'credit' ? '#DC2626' : '#1F2937' }}
            >
              <Text className="text-white font-bold text-sm">💸 Gave Udhar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEntryType('repayment')}
              className="flex-1 rounded-xl py-3 items-center"
              style={{ backgroundColor: entryType === 'repayment' ? '#059669' : '#1F2937' }}
            >
              <Text className="text-white font-bold text-sm">✅ Received Payment</Text>
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <View className="flex-row items-center bg-[#0F1424] border border-gray-800 rounded-2xl px-4 py-3 mb-3">
            <Text className="text-gray-400 text-base font-bold mr-2">₹</Text>
            <TextInput
              className="flex-1 text-white text-base font-semibold"
              placeholder="Enter amount"
              placeholderTextColor="#4B5563"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              returnKeyType="next"
            />
          </View>

          {/* Note */}
          <TextInput
            className="bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4"
            placeholder="Add a note (optional)"
            placeholderTextColor="#4B5563"
            value={note}
            onChangeText={setNote}
            returnKeyType="done"
          />

          {/* Save Entry */}
          <TouchableOpacity
            onPress={handleSaveEntry}
            disabled={isBusy || !amount.trim()}
            className="rounded-2xl py-4 items-center"
            style={{
              backgroundColor: isBusy || !amount.trim() ? '#1F2937' : '#6366F1',
              opacity: isBusy || !amount.trim() ? 0.5 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-bold text-base">Save Entry</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Transaction History ───────────────────────────────────────── */}
        <Text className="text-white text-lg font-bold mb-4">Transaction History</Text>

        {txLoading ? (
          <View className="justify-center items-center py-8">
            <ActivityIndicator size="small" color="#6366F1" />
          </View>
        ) : transactions.length === 0 ? (
          <View className="justify-center items-center py-8">
            <Text className="text-gray-500 text-sm font-semibold text-center">
              No transactions yet. Record the first udhar entry above.
            </Text>
          </View>
        ) : (
          <View style={{ minHeight: transactions.length * 64 }}>
            <FlashListCast
              data={transactions}
              keyExtractor={(item: UdharTransaction) => item.id}
              estimatedItemSize={64}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }: { item: UdharTransaction }) => (
                <TransactionRow item={item} />
              )}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
