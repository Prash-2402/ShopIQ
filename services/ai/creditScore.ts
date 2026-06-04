import { getBillsHistory } from '../supabase/billing';
import { getInventory } from '../supabase/inventory';
import { getCustomers } from '../supabase/udhar';

export interface CreditScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  breakdown: {
    revenueConsistency: number;
    billVolume: number;
    inventoryManagement: number;
    udharRepaymentRate: number;
  };
  summary: string;
}

export const generateCreditScore = async (phone: string): Promise<CreditScoreResult> => {
  try {
    const bills = await getBillsHistory(phone);
    const inventory = await getInventory(phone);
    const customers = await getCustomers(phone);

    // 1. Revenue Consistency (0-30 pts)
    const now = new Date();
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
    const last12WeeksBills = bills.filter((b: any) => new Date(b.created_at || b.createdAt) >= twelveWeeksAgo);

    const weeklyRevenue = new Array(12).fill(0);
    last12WeeksBills.forEach((b: any) => {
      const bDate = new Date(b.created_at || b.createdAt);
      const diffTime = now.getTime() - bDate.getTime();
      const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks >= 0 && diffWeeks < 12) {
        weeklyRevenue[11 - diffWeeks] += parseFloat(String(b.total));
      }
    });

    const weeksWithRevenue = weeklyRevenue.filter(r => r > 0).length;
    let revenueConsistency = Math.round(30 * (weeksWithRevenue / 12));

    const first4Avg = weeklyRevenue.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
    const last4Avg = weeklyRevenue.slice(8, 12).reduce((a, b) => a + b, 0) / 4;
    if (last4Avg > first4Avg) {
      revenueConsistency = Math.min(30, revenueConsistency + 5);
    }

    // 2. Bill Volume (0-25 pts)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last30DaysBillsCount = bills.filter((b: any) => new Date(b.created_at || b.createdAt) >= thirtyDaysAgo).length;
    let billVolume = 10;
    if (last30DaysBillsCount >= 50) billVolume = 25;
    else if (last30DaysBillsCount >= 30) billVolume = 22;
    else if (last30DaysBillsCount >= 10) billVolume = 18;

    // 3. Inventory Management (0-25 pts)
    let inventoryManagement = 15;
    if (!inventory || inventory.length === 0) {
      inventoryManagement = 5;
    } else {
      const itemsBelowThreshold = inventory.filter((i: any) => parseFloat(String(i.quantity)) <= parseInt(String(i.low_stock_threshold || i.lowStockThreshold || 5), 10));
      if (itemsBelowThreshold.length === 0) inventoryManagement += 5;

      const itemsPastExpiry = inventory.filter((i: any) => {
        const expDate = i.expiry_date || i.expiryDate;
        if (!expDate) return false;
        return new Date(expDate) < now;
      });
      if (itemsPastExpiry.length === 0) inventoryManagement += 5;
    }

    // 4. Udhar Repayment Rate (0-20 pts)
    let totalCredited = 0;
    let totalRepaid = 0;
    
    customers.forEach((c: any) => {
      const credited = parseFloat(String(c.totalSpend || 0));
      const bal = parseFloat(String(c.balance || 0));
      const repaid = credited - bal;
      
      totalCredited += credited;
      totalRepaid += repaid;
    });

    let udharRepaymentRate = 20;
    if (totalCredited > 0) {
      const rate = Math.min(1.0, totalRepaid / totalCredited);
      udharRepaymentRate = Math.round(rate * 20);
    }

    // 5. Score & Grade
    const score = Math.round(revenueConsistency + billVolume + inventoryManagement + udharRepaymentRate);
    
    let grade: 'A' | 'B' | 'C' | 'D' = 'D';
    if (score >= 80) grade = 'A';
    else if (score >= 60) grade = 'B';
    else if (score >= 40) grade = 'C';

    const summaryMap = {
      A: "Excellent business health. You are highly creditworthy and maintain strong operations.",
      B: "Good business performance. Consistent operations with minor areas for improvement.",
      C: "Fair business health. Focus on increasing regular sales and recovering pending udhar.",
      D: "Needs attention. Irregular sales and high udhar risk are impacting your score."
    };

    return {
      score,
      grade,
      breakdown: {
        revenueConsistency,
        billVolume,
        inventoryManagement,
        udharRepaymentRate
      },
      summary: summaryMap[grade]
    };

  } catch (error) {
    console.error('[creditScore] generateCreditScore error:', error);
    return {
      score: 0,
      grade: 'D',
      breakdown: {
        revenueConsistency: 0,
        billVolume: 0,
        inventoryManagement: 0,
        udharRepaymentRate: 0,
      },
      summary: "Could not generate score due to an error."
    };
  }
};
