import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getBillsHistory, syncPendingBills, LocalBill } from '../../services/supabase/billing';
import { fetchLiveIntelligence, LiveIntelligence } from '../../services/supabase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DashboardScreen() {
  const router = useRouter();
  const storeName = useAuthStore((state) => state.storeName) || 'My Store';
  const phone = useAuthStore((state) => state.phone) || '';

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [bills, setBills] = useState<LocalBill[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [intelligence, setIntelligence] = useState<LiveIntelligence | null>(null);

  const loadData = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      const history = await getBillsHistory(phone);
      setBills(history);

      const storedPending = await AsyncStorage.getItem('@pending_bills');
      if (storedPending) {
        const pendingList = JSON.parse(storedPending) as LocalBill[];
        setPendingCount(pendingList.filter((b) => b.phone === phone).length);
      } else {
        setPendingCount(0);
      }

      const intel = await fetchLiveIntelligence(phone);
      setIntelligence(intel);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    const intervalId = setInterval(() => {
      loadData(false);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncPendingBills();
      if (result.successCount > 0) {
        alert(`Successfully synced ${result.successCount} pending bills!`);
      }
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  // Calculate stats from today's bills
  const getStats = () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayBills = bills.filter((b) => b.createdAt.startsWith(today));
    
    const revenue = todayBills.reduce((acc, b) => acc + b.total, 0);
    const count = todayBills.length;
    const avg = count > 0 ? Math.round(revenue / count) : 0;

    return {
      revenue: `₹${revenue.toLocaleString('en-IN')}`,
      avgBill: `₹${avg.toLocaleString('en-IN')}`,
      totalBills: count.toString(),
    };
  };

  const stats = getStats();

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6 mt-4">
          <View>
            <Text className="text-gray-400 text-sm">Welcome back 👋</Text>
            <Text className="text-white text-2xl font-extrabold tracking-tight mt-1">{storeName}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => loadData()}
            className="w-12 h-12 bg-[#13192B] border border-gray-800 rounded-full items-center justify-center shadow-md"
          >
            {loading ? <ActivityIndicator size="small" color="#6366F1" /> : <Text className="text-lg">🔄</Text>}
          </TouchableOpacity>
        </View>

        {/* Pending Sync Banner */}
        {pendingCount > 0 && (
          <TouchableOpacity
            onPress={handleManualSync}
            disabled={syncing}
            className="bg-amber-950/40 border border-amber-900/60 rounded-3xl p-5 mb-6 flex-row justify-between items-center"
          >
            <View className="flex-1 mr-4">
              <Text className="text-amber-400 font-extrabold text-sm">⚠️ Offline Bills Pending</Text>
              <Text className="text-gray-400 text-xs mt-1">
                {pendingCount} bill{pendingCount > 1 ? 's' : ''} saved locally. Tap to sync online.
              </Text>
            </View>
            {syncing ? (
              <ActivityIndicator color="#F59E0B" />
            ) : (
              <View className="bg-amber-500/20 px-3 py-1.5 rounded-xl">
                <Text className="text-amber-400 font-bold text-xs">Sync Now</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Dashboard Cards Grid */}
        <View className="mb-8">
          <Text className="text-white text-lg font-bold mb-4">Today's Overview</Text>
          
          {/* Main Revenue Card */}
          <View className="bg-indigo-600 rounded-3xl p-6 mb-4 shadow-xl shadow-indigo-500/20">
            <Text className="text-indigo-200 text-sm font-semibold uppercase tracking-wider">Today's Revenue</Text>
            <Text className="text-white text-4xl font-extrabold mt-2">{stats.revenue}</Text>
            <View className="flex-row items-center mt-4 bg-indigo-700/50 self-start px-3 py-1 rounded-full">
              <Text className="text-indigo-200 text-xs font-semibold">Active Sales Metrics</Text>
            </View>
          </View>

          {/* Side-by-side stats */}
          <View className="flex-row justify-between">
            {/* Avg Bill Card */}
            <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 w-[48%] shadow-md">
              <Text className="text-gray-400 text-xs font-semibold">Avg Bill Value</Text>
              <Text className="text-white text-2xl font-bold mt-2">{stats.avgBill}</Text>
            </View>

            {/* Total Bills Card */}
            <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 w-[48%] shadow-md">
              <Text className="text-gray-400 text-xs font-semibold">Bills Created</Text>
              <Text className="text-white text-2xl font-bold mt-2">{stats.totalBills}</Text>
            </View>
          </View>
        </View>

        {/* Live Intelligence Panel */}
        {intelligence && (
          <View className="mb-8">
            <Text className="text-white text-lg font-bold mb-4">Live Intelligence</Text>
            
            <View className="bg-[#13192B] border border-indigo-900/40 rounded-3xl p-5 mb-4 shadow-md">
              <View className="flex-row items-center mb-3">
                <Text className="text-xl mr-2">🕒</Text>
                <View>
                  <Text className="text-gray-400 text-xs font-semibold">Peak Shopping Hours</Text>
                  <Text className="text-white font-bold text-base mt-0.5">{intelligence.peakHour}</Text>
                </View>
              </View>
              <Text className="text-gray-400 text-xs leading-5">{intelligence.peakHourDescription}</Text>
            </View>

            <View className="flex-row justify-between mb-4">
              {/* Category Card */}
              <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 w-[48%] shadow-md">
                <Text className="text-2xl mb-1">🏷️</Text>
                <Text className="text-gray-400 text-xs font-semibold">Top Category</Text>
                <Text className="text-white font-bold text-base mt-1" numberOfLines={1}>
                  {intelligence.topCategory}
                </Text>
                <Text className="text-emerald-400 font-extrabold text-[11px] mt-0.5">
                  {intelligence.topCategoryRevenue}
                </Text>
              </View>

              {/* Smart Advice Card */}
              <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 w-[48%] shadow-md">
                <Text className="text-2xl mb-1">💡</Text>
                <Text className="text-gray-400 text-xs font-semibold">AI Recommendation</Text>
                <Text className="text-white font-bold text-[11px] mt-1.5 leading-4" numberOfLines={4}>
                  {intelligence.smartAdvice}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View className="mb-8">
          <Text className="text-white text-lg font-bold mb-4">Quick Actions</Text>

          {/* New Bill Button */}
          <TouchableOpacity
            onPress={() => router.push('/bill/new')}
            className="w-full bg-emerald-600 py-5 rounded-3xl items-center justify-center flex-row shadow-lg shadow-emerald-500/20 mb-4"
          >
            <Text className="text-white text-2xl mr-3">➕</Text>
            <Text className="text-white text-lg font-extrabold">Create New Bill</Text>
          </TouchableOpacity>

          <View className="flex-row justify-between">
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/history')}
              className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 w-[48%] items-center justify-center shadow-md"
            >
              <Text className="text-3xl mb-2">📜</Text>
              <Text className="text-white font-bold">View History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/analytics')}
              className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 w-[48%] items-center justify-center shadow-md"
            >
              <Text className="text-3xl mb-2">📈</Text>
              <Text className="text-white font-bold">Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions List Header */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-lg font-bold">Recent Bills</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text className="text-indigo-400 font-semibold text-sm">See All</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Recent Bills List */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-4 shadow-md">
          {bills.length > 0 ? (
            bills.slice(0, 5).map((bill) => (
              <TouchableOpacity 
                key={bill.id} 
                onPress={() => router.push(`/bill/${bill.id}`)}
                className="flex-row justify-between items-center border-b border-gray-800/50 py-3 last:border-b-0"
              >
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-10 h-10 bg-indigo-900/40 rounded-xl items-center justify-center mr-3">
                    <Text className="text-lg">🧾</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-white font-semibold text-base mr-2">{bill.billNumber}</Text>
                      {!bill.synced && (
                        <View className="bg-amber-950 border border-amber-900 px-1.5 py-0.5 rounded">
                          <Text className="text-amber-400 font-black text-[8px]">LOCAL</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {bill.items.length} item{bill.items.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <Text className="text-white font-bold text-base">₹{bill.total}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View className="items-center py-6">
              <Text className="text-gray-500 text-sm">No bills registered today</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
