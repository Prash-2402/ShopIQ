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
  useTopProducts,
  useDemandPredictions,
  useProfitStats,
} from '../../hooks/useAnalytics';
import { DemandPrediction } from '../../services/ai/demandPrediction';

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
  const { data: predictions = [], isLoading: predictionsLoading, refetch: refetchPredictions } = useDemandPredictions(phone);
  const { data: profitStats, isLoading: profitLoading, refetch: refetchProfit } = useProfitStats(phone);

  const handleRefreshAll = () => {
    refetchStats();
    refetchMonthly();
    refetchWeekly();
    refetchProducts();
    refetchPredictions();
    refetchProfit();
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

        {/* ── Profit Overview ──────────────────────────────────────── */}
        {profitLoading ? (
          <StatSkeleton />
        ) : profitStats ? (
          <>
            {/* Profit card */}
            <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6">
              <Text className="text-white font-bold text-base mb-4">30-Day Profit Overview</Text>

              {/* Revenue row */}
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-400 text-sm">Revenue</Text>
                <Text className="text-white font-extrabold">
                  ₹{profitStats.totalRevenue.toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Cost row */}
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-400 text-sm">Est. Cost</Text>
                <Text className="text-gray-400 font-semibold">
                  ₹{profitStats.totalCost.toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Profit row */}
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-400 text-sm">Profit</Text>
                <Text
                  className={`font-extrabold ${
                    profitStats.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  ₹{profitStats.totalProfit.toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Margin badge */}
              <View className="bg-indigo-950 px-3 py-1 rounded-xl self-start mt-3">
                <Text className="text-indigo-300 text-xs font-bold">
                  {profitStats.profitMarginPercent}% margin
                </Text>
              </View>
            </View>

            {/* Dead stock card */}
            {profitStats.deadStockItems.length > 0 ? (
              <View className="bg-amber-950/30 border border-amber-900/40 rounded-3xl p-5 mb-6">
                <Text className="text-amber-400 font-bold text-sm">
                  📦 Dead Stock ({profitStats.deadStockItems.length} item{profitStats.deadStockItems.length > 1 ? 's' : ''})
                </Text>
                <Text className="text-gray-400 text-xs mt-0.5">Items unsold for 30+ days</Text>
                <Text className="text-gray-500 text-xs mt-1">
                  {profitStats.deadStockItems
                    .slice(0, 5)
                    .map((i) => i.name)
                    .join(' • ')}
                </Text>
              </View>
            ) : null}
          </>
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

        {/* ── Demand Predictions ──────────────────────────────────────── */}
        <View className="mb-6">
          <Text className="text-white text-lg font-bold mb-4">🔮 Next Week Predictions</Text>

          {predictionsLoading ? (
            <ChartSkeleton />
          ) : predictions.length === 0 ? (
            <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-6">
              <Text className="text-gray-500 text-sm text-center py-6">
                📊 Not enough sales data yet. Keep creating bills to unlock AI predictions.
              </Text>
            </View>
          ) : (
            predictions.map((pred: DemandPrediction, idx: number) => {
              const trendStyle = pred.trend === 'rising'
                ? { badge: 'bg-emerald-950', text: 'text-emerald-400', label: '↑ RISING' }
                : pred.trend === 'falling'
                ? { badge: 'bg-red-950', text: 'text-red-400', label: '↓ FALLING' }
                : { badge: 'bg-gray-800', text: 'text-gray-400', label: '→ STABLE' };

              return (
                <View
                  key={`${pred.itemName}-${idx}`}
                  className="bg-[#13192B] border border-gray-800 rounded-2xl p-4 mb-3 flex-row justify-between items-start"
                >
                  {/* Left */}
                  <View className="flex-1 mr-3">
                    <Text className="text-white font-bold text-sm" numberOfLines={1}>
                      {pred.itemName}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={2}>
                      {pred.reasoning}
                    </Text>
                    {pred.currentStock !== null ? (
                      <Text className="text-gray-500 text-xs mt-1">
                        In stock: {pred.currentStock} units
                      </Text>
                    ) : null}
                  </View>

                  {/* Right */}
                  <View className="items-end">
                    <View className={`${trendStyle.badge} px-2 py-0.5 rounded mb-1`}>
                      <Text className={`${trendStyle.text} text-[9px] font-black`}>
                        {trendStyle.label}
                      </Text>
                    </View>
                    <Text className="text-white font-extrabold text-base">
                      {pred.predictedQuantity} units
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
