import { useQuery } from '@tanstack/react-query';
import { 
  fetchOverviewStats, 
  fetchMonthlyRevenueTrend, 
  fetchWeeklyRevenueTrend, 
  fetchTopSellingProducts,
  fetchProfitStats,
} from '../services/supabase/analytics';
import { generateDemandPredictions } from '../services/ai/demandPrediction';
import { generateCreditScore } from '../services/ai/creditScore';

export const useAnalyticsStats = (phone: string) => {
  return useQuery({
    queryKey: ['analyticsStats', phone],
    queryFn: () => fetchOverviewStats(phone),
    enabled: !!phone,
    staleTime: 5 * 60 * 1000,
  });
};

export const useMonthlyRevenue = (phone: string) => {
  return useQuery({
    queryKey: ['monthlyRevenue', phone],
    queryFn: () => fetchMonthlyRevenueTrend(phone),
    enabled: !!phone,
    staleTime: 5 * 60 * 1000,
  });
};

export const useWeeklyRevenue = (phone: string) => {
  return useQuery({
    queryKey: ['weeklyRevenue', phone],
    queryFn: () => fetchWeeklyRevenueTrend(phone),
    enabled: !!phone,
    staleTime: 5 * 60 * 1000,
  });
};

export const useTopProducts = (phone: string) => {
  return useQuery({
    queryKey: ['topProducts', phone],
    queryFn: () => fetchTopSellingProducts(phone),
    enabled: !!phone,
    staleTime: 5 * 60 * 1000,
  });
};

export const useDemandPredictions = (phone: string) => {
  return useQuery({
    queryKey: ['demandPredictions', phone],
    queryFn: () => generateDemandPredictions(phone),
    enabled: !!phone,
    staleTime: 10 * 60 * 1000,
  });
};

export const useProfitStats = (phone: string) => {
  return useQuery({
    queryKey: ['profitStats', phone],
    queryFn: () => fetchProfitStats(phone),
    enabled: !!phone,
    staleTime: 5 * 60 * 1000,
  });
};


