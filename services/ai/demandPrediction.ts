import { getBillsHistory } from '../supabase/billing';
import { getInventory } from '../supabase/inventory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemandPrediction {
  itemName: string;
  /** Units expected to be needed next week. */
  predictedQuantity: number;
  /** Current inventory quantity, or null if item is not tracked in stock. */
  currentStock: number | null;
  trend: 'rising' | 'stable' | 'falling';
  /** One short human-readable sentence explaining the prediction. */
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const TREND_THRESHOLD = 0.15; // 15% change triggers a rising/falling label
const TOP_N = 10;
const MIN_APPEARANCES = 2;
const WEEKS = 13; // 91 days ≈ 13 weeks

/**
 * Return the week index (0 = oldest, WEEKS-1 = most recent) for a given date
 * relative to a fixed reference point (90 days ago from `now`).
 */
function weekIndex(dateMs: number, windowStartMs: number): number {
  const diff = dateMs - windowStartMs;
  const idx = Math.floor(diff / MS_PER_WEEK);
  return Math.max(0, Math.min(WEEKS - 1, idx));
}

/**
 * Average of an array of numbers. Returns 0 for empty arrays.
 */
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Determine trend from a weekly sales array.
 * Compares the average of the first 2 weeks vs the last 2 weeks.
 */
function computeTrend(
  weeklyQty: number[],
): 'rising' | 'stable' | 'falling' {
  const early = avg(weeklyQty.slice(0, 2));
  const recent = avg(weeklyQty.slice(-2));

  if (early === 0) {
    // No early data — treat as rising if there are any recent sales
    return recent > 0 ? 'rising' : 'stable';
  }

  const change = (recent - early) / early;

  if (change > TREND_THRESHOLD) return 'rising';
  if (change < -TREND_THRESHOLD) return 'falling';
  return 'stable';
}

/**
 * Build a one-sentence reasoning string for the given trend and weekly average.
 */
function buildReasoning(
  trend: 'rising' | 'stable' | 'falling',
  weeklyAvg: number,
): string {
  switch (trend) {
    case 'rising':
      return `Sales have been increasing — stocking ~${Math.ceil(weeklyAvg * 1.1)} units should cover rising demand.`;
    case 'falling':
      return `Sales are slowing down — a leaner stock of ~${Math.ceil(weeklyAvg * 0.9)} units is recommended.`;
    case 'stable':
      return `Demand is steady at roughly ${Math.ceil(weeklyAvg)} units per week.`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse the last 90 days of bill history and produce demand predictions for
 * the coming week. Uses pure TypeScript arithmetic — no external ML library.
 *
 * Returns an empty array on any error so callers never crash.
 */
export const generateDemandPredictions = async (
  phone: string,
): Promise<DemandPrediction[]> => {
  try {
    const [allBills, inventory] = await Promise.all([
      getBillsHistory(phone),
      getInventory(phone),
    ]);

    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    // Filter to last 90 days
    const recentBills = allBills.filter(
      (b) => new Date(b.createdAt).getTime() >= ninetyDaysAgo,
    );

    if (recentBills.length === 0) return [];

    // Fixed window start — the Monday-aligned start of the 90-day window.
    // We use the actual oldest bill's start-of-week for consistency.
    const windowStartMs = ninetyDaysAgo;

    // ── Step 3: Build per-item weekly sales map ──────────────────────────
    // { normalisedName: number[WEEKS] }
    const weeklyMap: Map<string, number[]> = new Map();
    // Store original casing from first occurrence
    const originalName: Map<string, string> = new Map();
    // Total appearances per item (for the MIN_APPEARANCES filter)
    const appearances: Map<string, number> = new Map();

    for (const bill of recentBills) {
      const billMs = new Date(bill.createdAt).getTime();
      const wIdx = weekIndex(billMs, windowStartMs);

      for (const item of bill.items) {
        const key = item.name.trim().toLowerCase();
        if (!key) continue;

        if (!weeklyMap.has(key)) {
          weeklyMap.set(key, new Array(WEEKS).fill(0));
          originalName.set(key, item.name.trim());
          appearances.set(key, 0);
        }

        const weeks = weeklyMap.get(key)!;
        weeks[wIdx] += item.quantity;
        appearances.set(key, (appearances.get(key) ?? 0) + 1);
      }
    }

    // ── Build inventory lookup map (case-insensitive name → quantity) ────
    const inventoryMap: Map<string, number> = new Map(
      inventory.map((inv) => [inv.name.trim().toLowerCase(), inv.quantity]),
    );

    // ── Step 4 + 5: Compute predictions ─────────────────────────────────
    const predictions: DemandPrediction[] = [];

    for (const [key, weeks] of weeklyMap.entries()) {
      // Filter out items that appeared fewer than MIN_APPEARANCES times
      if ((appearances.get(key) ?? 0) < MIN_APPEARANCES) continue;

      // Average of last 4 weeks only
      const last4 = weeks.slice(-4);
      const last4Avg = avg(last4);

      if (last4Avg === 0) continue; // No recent sales — skip

      const trend = computeTrend(weeks);

      const multiplier =
        trend === 'rising' ? 1.1 : trend === 'falling' ? 0.9 : 1.0;

      const predictedQuantity = Math.ceil(last4Avg * multiplier);

      const currentStock = inventoryMap.has(key)
        ? (inventoryMap.get(key) ?? null)
        : null;

      predictions.push({
        itemName: originalName.get(key) ?? key,
        predictedQuantity,
        currentStock,
        trend,
        reasoning: buildReasoning(trend, last4Avg),
      });
    }

    // ── Step 6 + 7: Sort and cap ─────────────────────────────────────────
    predictions.sort((a, b) => b.predictedQuantity - a.predictedQuantity);
    return predictions.slice(0, TOP_N);
  } catch (err) {
    console.error('[demandPrediction] generateDemandPredictions error:', err);
    return [];
  }
};
