import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';
import { FlashList } from '@shopify/flash-list';
import { useAuthStore } from '../../store/authStore';

const FlashListCast = FlashList as any;
import { 
  useAnalyticsStats, 
  useMonthlyRevenue, 
  useWeeklyRevenue, 
  useTopProducts 
} from '../../hooks/useAnalytics';

// Loading Skeleton component for overview cards
function StatSkeleton() {
  return (
    <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6 animate-pulse">
      <View className="flex-row justify-between items-center mb-4">
        <View className="w-1/2 h-4 bg-gray-800 rounded" />
        <View className="w-16 h-6 bg-gray-800 rounded-xl" />
      </View>
      <View className="w-2/3 h-8 bg-gray-800 rounded mb-4" />
      <View className="border-t border-gray-800/80 pt-4 flex-row justify-between">
        <View className="w-24 h-4 bg-gray-800 rounded" />
        <View className="w-16 h-4 bg-gray-800 rounded" />
      </View>
    </View>
  );
}

// Loading Skeleton component for charts
function ChartSkeleton() {
  return (
    <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6 items-center animate-pulse">
      <View className="w-1/3 h-5 bg-gray-800 rounded self-start mb-6" />
      <View className="flex-row items-end justify-between w-full h-[150px] px-2 mb-4">
        <View className="w-[10%] h-[30%] bg-gray-800 rounded-t" />
        <View className="w-[10%] h-[50%] bg-gray-800 rounded-t" />
        <View className="w-[10%] h-[20%] bg-gray-800 rounded-t" />
        <View className="w-[10%] h-[70%] bg-gray-800 rounded-t" />
        <View className="w-[10%] h-[40%] bg-gray-800 rounded-t" />
        <View className="w-[10%] h-[90%] bg-gray-800 rounded-t" />
      </View>
      <View className="w-2/3 h-4 bg-gray-800 rounded" />
    </View>
  );
}

export default function AnalyticsScreen() {
  const phone = useAuthStore((state) => state.phone) || '';

  // 1. Fetch real analytics data via optimized React Query hooks
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useAnalyticsStats(phone);
  const { data: monthlyData, isLoading: monthlyLoading, refetch: refetchMonthly } = useMonthlyRevenue(phone);
  const { data: weeklyData, isLoading: weeklyLoading, refetch: refetchWeekly } = useWeeklyRevenue(phone);
  const { data: topProducts, isLoading: productsLoading, refetch: refetchProducts } = useTopProducts(phone);

  const handleRefreshAll = () => {
    refetchStats();
    refetchMonthly();
    refetchWeekly();
    refetchProducts();
  };

  // 2. Memoize monthly chart data conversion to prevent unwanted re-renders
  const memoizedMonthlyChart = useMemo(() => {
    if (!monthlyData) return [];
    
    // Gradient custom mappings for monthly values
    return monthlyData.map((pt, idx) => ({
      value: pt.value,
      label: pt.label,
      frontColor: idx === monthlyData.length - 1 ? '#10B981' : '#6366F1', // highlight current month in emerald
    }));
  }, [monthlyData]);

  // 3. Memoize weekly chart data
  const memoizedWeeklyChart = useMemo(() => {
    if (!weeklyData) return [];
    return weeklyData.map((pt, idx) => ({
      value: pt.value,
      label: pt.label,
      frontColor: idx === weeklyData.length - 1 ? '#10B981' : '#4F46E5',
    }));
  }, [weeklyData]);

  const renderProductItem = ({ item, index }: { item: any; index: number }) => (
    <View className="flex-row justify-between items-center border-b border-gray-800/50 py-3.5 last:border-b-0">
      <View className="flex-row items-center flex-1 mr-4">
        <View className="w-8 h-8 bg-indigo-950 rounded-xl items-center justify-center mr-3">
          <Text className="text-indigo-400 font-bold text-sm">#{index + 1}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-white font-bold text-sm" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-gray-400 text-xs mt-0.5">{item.sales}</Text>
        </View>
      </View>
      <Text className="text-white font-extrabold text-sm">{item.revenue}</Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6 mt-4">
          <View>
            <Text className="text-white text-3xl font-extrabold tracking-tight">Business Analytics</Text>
            <Text className="text-gray-400 text-sm mt-1">Detailed performance metrics of your store</Text>
          </View>
          <TouchableOpacity 
            onPress={handleRefreshAll}
            className="w-12 h-12 bg-[#13192B] border border-gray-800 rounded-full items-center justify-center shadow-md"
          >
            <Text className="text-lg">🔄</Text>
          </TouchableOpacity>
        </View>

        {/* Error Fallback view */}
        {statsError && (
          <View className="bg-red-950/30 border border-red-900/50 rounded-3xl p-5 mb-6">
            <Text className="text-red-400 font-bold">Failed to load statistics.</Text>
            <TouchableOpacity onPress={handleRefreshAll} className="mt-2.5">
              <Text className="text-indigo-400 font-semibold underline text-sm">Tap to retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Section Skeletons or Cards */}
        {statsLoading ? (
          <StatSkeleton />
        ) : stats ? (
          <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6 shadow-sm">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-gray-400 text-xs font-semibold">Weekly Sales Revenue</Text>
                <Text className="text-white text-3xl font-black mt-1">
                  ₹{stats.weeklyRevenue.toLocaleString('en-IN')}
                </Text>
              </View>
              <View className={`px-3 py-1.5 rounded-xl ${stats.revenueChangePercent >= 0 ? 'bg-emerald-950' : 'bg-red-950'}`}>
                <Text className={`text-xs font-bold ${stats.revenueChangePercent >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {stats.revenueChangePercent >= 0 ? `▲ +${stats.revenueChangePercent}%` : `▼ ${stats.revenueChangePercent}%`}
                </Text>
              </View>
            </View>
            <View className="border-t border-gray-800/80 pt-4 flex-row justify-between">
              <View>
                <Text className="text-gray-400 text-xs font-semibold">Avg. Order Value</Text>
                <Text className="text-white text-lg font-bold mt-1">
                  ₹{stats.avgBillValue.toLocaleString('en-IN')}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-400 text-xs font-semibold">Total Invoiced Bills</Text>
                <Text className="text-white text-lg font-bold mt-1">{stats.totalBills}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Weekly Revenue Chart Section */}
        {weeklyLoading ? (
          <ChartSkeleton />
        ) : memoizedWeeklyChart.length > 0 ? (
          <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6 shadow-sm items-center">
            <Text className="text-white text-base font-bold mb-6 self-start">Weekly Revenue Trend</Text>
            <BarChart
              data={memoizedWeeklyChart}
              barWidth={24}
              spacing={16}
              noOfSections={4}
              barBorderRadius={6}
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#9CA3AF', fontSize: 10, fontWeight: 'bold' }}
              hideRules
              height={180}
            />
          </View>
        ) : null}

        {/* Monthly Revenue Chart Section */}
        {monthlyLoading ? (
          <ChartSkeleton />
        ) : memoizedMonthlyChart.length > 0 ? (
          <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6 shadow-sm items-center">
            <Text className="text-white text-base font-bold mb-6 self-start">Monthly Revenue trend</Text>
            <BarChart
              data={memoizedMonthlyChart}
              barWidth={24}
              spacing={16}
              noOfSections={4}
              barBorderRadius={6}
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#9CA3AF', fontSize: 10, fontWeight: 'bold' }}
              hideRules
              height={180}
            />
          </View>
        ) : null}

        {/* Top Selling Products utilizing Shopify FlashList */}
        <View className="mb-6">
          <Text className="text-white text-lg font-bold mb-4">Top-Selling Products</Text>
          <View style={{ height: 350 }} className="bg-[#13192B] border border-gray-800 rounded-3xl p-4 shadow-sm">
            {productsLoading ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            ) : topProducts && topProducts.length > 0 ? (
              <FlashListCast
                data={topProducts}
                renderItem={renderProductItem}
                estimatedItemSize={60}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View className="flex-1 justify-center items-center py-12">
                <Text className="text-3xl mb-3">📦</Text>
                <Text className="text-gray-500 text-sm font-semibold text-center">
                  Create bills first to identify top selling items
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
