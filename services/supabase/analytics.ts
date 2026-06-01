import { getBillsHistory } from './billing';
import { getLocalCache } from './products';
import { getInventory, InventoryItem } from './inventory';

export interface LiveIntelligence {
  peakHour: string;
  peakHourDescription: string;
  topCategory: string;
  topCategoryRevenue: string;
  smartAdvice: string;
}

export interface AnalyticsStats {
  weeklyRevenue: number;
  avgBillValue: number;
  totalBills: number;
  revenueChangePercent: number;
}

export interface ChartDataPoint {
  value: number;
  label: string;
}

export interface BestSeller {
  name: string;
  sales: string;
  revenue: string;
}

export const fetchOverviewStats = async (phone: string): Promise<AnalyticsStats> => {
  const bills = await getBillsHistory(phone);
  
  const total = bills.length;
  const grandTotalRevenue = bills.reduce((acc, b) => acc + b.total, 0);
  const avg = total > 0 ? Math.round(grandTotalRevenue / total) : 0;
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyBills = bills.filter((b) => new Date(b.createdAt) >= oneWeekAgo);
  const weeklyRevenue = weeklyBills.reduce((acc, b) => acc + b.total, 0);

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const prevWeeklyBills = bills.filter(
    (b) => {
      const d = new Date(b.createdAt);
      return d >= twoWeeksAgo && d < oneWeekAgo;
    }
  );
  const prevWeeklyRevenue = prevWeeklyBills.reduce((acc, b) => acc + b.total, 0);
  
  let changePercent = 0;
  if (prevWeeklyRevenue > 0) {
    changePercent = Math.round(((weeklyRevenue - prevWeeklyRevenue) / prevWeeklyRevenue) * 100);
  } else if (weeklyRevenue > 0) {
    changePercent = 100;
  }

  return {
    weeklyRevenue,
    avgBillValue: avg,
    totalBills: total,
    revenueChangePercent: changePercent,
  };
};

export const fetchMonthlyRevenueTrend = async (phone: string): Promise<ChartDataPoint[]> => {
  const bills = await getBillsHistory(phone);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trendMap: Record<string, number> = {};
  
  const now = new Date();
  const buckets: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${months[d.getMonth()]}`;
    buckets.push(label);
    trendMap[label] = 0;
  }

  bills.forEach((bill) => {
    const date = new Date(bill.createdAt);
    const label = months[date.getMonth()];
    if (trendMap[label] !== undefined) {
      trendMap[label] += bill.total;
    }
  });

  return buckets.map((label) => ({
    value: trendMap[label],
    label,
  }));
};

export const fetchWeeklyRevenueTrend = async (phone: string): Promise<ChartDataPoint[]> => {
  const bills = await getBillsHistory(phone);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const dailyTotals: Record<string, number> = {
    'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0
  };

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  bills.forEach((bill) => {
    const date = new Date(bill.createdAt);
    if (date >= oneWeekAgo) {
      const dayLabel = days[date.getDay()];
      if (dailyTotals[dayLabel] !== undefined) {
        dailyTotals[dayLabel] += bill.total;
      }
    }
  });

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
    value: dailyTotals[day],
    label: day,
  }));
};

export const fetchTopSellingProducts = async (phone: string): Promise<BestSeller[]> => {
  const bills = await getBillsHistory(phone);
  
  const productStatsMap: Record<string, { quantity: number; revenue: number }> = {};
  
  bills.forEach((bill) => {
    bill.items.forEach((item) => {
      if (!productStatsMap[item.name]) {
        productStatsMap[item.name] = { quantity: 0, revenue: 0 };
      }
      productStatsMap[item.name].quantity += item.quantity;
      productStatsMap[item.name].revenue += item.subtotal;
    });
  });

  const sortedProducts = Object.keys(productStatsMap)
    .map((name) => ({
      name,
      quantity: productStatsMap[name].quantity,
      revenue: productStatsMap[name].revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity);

  return sortedProducts.slice(0, 10).map((p) => ({
    name: p.name,
    sales: `${p.quantity} unit${p.quantity > 1 ? 's' : ''}`,
    revenue: `₹${p.revenue.toLocaleString('en-IN')}`,
  }));
};

export const fetchLiveIntelligence = async (phone: string): Promise<LiveIntelligence> => {
  const bills = await getBillsHistory(phone);
  const cache = await getLocalCache();

  const hourlyCounts: Record<number, number> = {};
  const categoryRevenue: Record<string, number> = {};

  bills.forEach((bill) => {
    const d = new Date(bill.createdAt);
    const hour = d.getHours();
    hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;

    bill.items.forEach((item) => {
      let category = 'General Store';
      const cached = cache.find(
        (c) =>
          c.name.toLowerCase() === item.name.toLowerCase() ||
          (item.barcode && c.barcode === item.barcode)
      );
      if (cached && cached.category) {
        category = cached.category;
      } else {
        const nameLower = item.name.toLowerCase();
        if (nameLower.match(/milk|curd|paneer|cheese|butter|dairy/)) {
          category = 'Dairy';
        } else if (nameLower.match(/biscuit|cookie|rusk|bread|bun|bakery|chips|snack/)) {
          category = 'Bakery & Snacks';
        } else if (nameLower.match(/soap|shampoo|paste|brush|detergent|handwash|clean|surf/)) {
          category = 'Household & Care';
        } else if (nameLower.match(/dal|rice|flour|atta|oil|ghee|sugar|salt|masala|spice|wheat/)) {
          category = 'Pantry Staples';
        } else if (nameLower.match(/coke|pepsi|juice|soda|drink|water|tea|coffee/)) {
          category = 'Beverages';
        } else if (nameLower.match(/apple|banana|onion|potato|tomato|fruit|veg/)) {
          category = 'Fruits & Veggies';
        }
      }
      categoryRevenue[category] = (categoryRevenue[category] || 0) + item.subtotal;
    });
  });

  let maxHour = -1;
  let maxHourCount = 0;
  Object.entries(hourlyCounts).forEach(([hourStr, count]) => {
    const hr = parseInt(hourStr);
    if (count > maxHourCount) {
      maxHourCount = count;
      maxHour = hr;
    }
  });

  let peakHourStr = 'Evening Rush (5:00 PM - 8:00 PM)';
  let peakHourDesc = 'Peak traffic usually occurs during late evening hours.';
  let smartAdvice = 'Keep rapid barcode scanner active and checkout counters clear during evening hours.';

  if (maxHour !== -1) {
    const ampm = maxHour >= 12 ? 'PM' : 'AM';
    const displayHour = maxHour % 12 === 0 ? 12 : maxHour % 12;
    const nextHour = (maxHour + 1) % 12 === 0 ? 12 : (maxHour + 1) % 12;
    const nextAmpm = (maxHour + 1) >= 12 ? 'PM' : 'AM';
    peakHourStr = `${displayHour}:00 ${ampm} - ${nextHour}:00 ${nextAmpm}`;

    if (maxHour >= 7 && maxHour < 12) {
      peakHourDesc = 'Morning grocery rush. Customer traffic spikes for breakfast essentials.';
      smartAdvice = 'Ensure fresh bread, dairy, and eggs are stocked and easily accessible at the checkout.';
    } else if (maxHour >= 12 && maxHour < 16) {
      peakHourDesc = 'Mid-day standard billing. Lighter traffic suitable for stock updates.';
      smartAdvice = 'Excellent window to sync pending offline bills, clean shelves, and update pricing cache.';
    } else if (maxHour >= 16 && maxHour < 21) {
      peakHourDesc = 'Evening peak hour. Busiest period of the day with high cart sizes.';
      smartAdvice = 'Pre-pack common loose grains and keep barcode scanner open for rapid checkouts.';
    } else {
      peakHourDesc = 'Late night / early morning traffic. Lower billing volumes.';
      smartAdvice = 'Ensure all local transactions from the day are synced to Supabase dashboard.';
    }
  }

  let topCategory = 'General Store';
  let topCategoryRev = 0;
  Object.entries(categoryRevenue).forEach(([cat, rev]) => {
    if (rev > topCategoryRev) {
      topCategoryRev = rev;
      topCategory = cat;
    }
  });

  return {
    peakHour: peakHourStr,
    peakHourDescription: peakHourDesc,
    topCategory,
    topCategoryRevenue: `₹${topCategoryRev.toLocaleString('en-IN')}`,
    smartAdvice,
  };
};

// ---------------------------------------------------------------------------
// Profit stats
// ---------------------------------------------------------------------------

export interface ProfitStats {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMarginPercent: number;
  /** Inventory items with stock > 0 that haven't appeared in any bill in the last 30 days. */
  deadStockItems: InventoryItem[];
}

/**
 * Compute 30-day profit figures and identify dead stock.
 * Cost is sourced from inventory (case-insensitive name match).
 * For items not in inventory, we assume a 30% margin: cost = sell * 0.7.
 */
export const fetchProfitStats = async (phone: string): Promise<ProfitStats> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [allBills, inventory] = await Promise.all([
    getBillsHistory(phone),
    getInventory(phone),
  ]);

  // Filter to last 30 days
  const recentBills = allBills.filter(
    (b) => new Date(b.createdAt) >= thirtyDaysAgo,
  );

  // Build a lowercase-name → costPrice lookup from inventory
  const costMap = new Map<string, number>(
    inventory.map((item) => [item.name.trim().toLowerCase(), item.costPrice]),
  );

  // Build set of item names that appeared in recent bills (for dead-stock check)
  const soldItemNames = new Set<string>();

  let totalRevenue = 0;
  let totalCost = 0;

  for (const bill of recentBills) {
    totalRevenue += bill.total;

    for (const item of bill.items) {
      const key = item.name.trim().toLowerCase();
      soldItemNames.add(key);

      const inventoryCost = costMap.get(key);
      const unitCost =
        inventoryCost !== undefined
          ? inventoryCost
          : item.price * 0.7; // 30% margin assumption for untracked items

      totalCost += unitCost * item.quantity;
    }
  }

  const totalProfit = totalRevenue - totalCost;
  const profitMarginPercent =
    totalRevenue > 0
      ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(1))
      : 0;

  // Dead stock: items with stock > 0 that weren't sold in the last 30 days
  const deadStockItems = inventory.filter(
    (item) =>
      item.quantity > 0 &&
      !soldItemNames.has(item.name.trim().toLowerCase()),
  );

  return {
    totalRevenue,
    totalCost,
    totalProfit,
    profitMarginPercent,
    deadStockItems,
  };
};

