import type {
  NormalizedFill,
  RealizedTrade,
  OpeningPosition,
  FifoLot,
  PnlSummary,
  SymbolSummary,
} from "./types";

type PositionKey = string;

function makeKey(symbolCode: string, accountType?: string): PositionKey {
  return `${symbolCode}::${accountType ?? ""}`;
}

export function calculateRealizedPnl(
  fills: NormalizedFill[],
  openingPositions: OpeningPosition[] = []
): {
  trades: RealizedTrade[];
  missingCostSymbols: { symbolCode: string; symbolName: string; shortQty: number; accountType: string }[];
} {
  // FIFO lot map: key -> lots[]
  const lots = new Map<PositionKey, FifoLot[]>();

  // Initialize with opening positions
  for (const op of openingPositions) {
    const key = makeKey(op.symbolCode, op.accountType);
    const existing = lots.get(key) ?? [];
    // Prepend opening position as first lot
    existing.unshift({ qty: op.qty, price: op.avgCost, fees: 0 });
    lots.set(key, existing);
  }

  const trades: RealizedTrade[] = [];
  const missingCostMap = new Map<string, { symbolCode: string; symbolName: string; shortQty: number; accountType: string }>();

  // Sort fills by date, then BUY before SELL on same date for same symbol
  const sorted = [...fills].sort((a, b) => {
    const dateCmp = a.tradeDate.localeCompare(b.tradeDate);
    if (dateCmp !== 0) return dateCmp;
    // BUY before SELL
    if (a.side === "BUY" && b.side === "SELL") return -1;
    if (a.side === "SELL" && b.side === "BUY") return 1;
    return 0;
  });

  for (const fill of sorted) {
    const key = makeKey(fill.symbolCode, fill.accountType);

    if (fill.side === "BUY") {
      const existing = lots.get(key) ?? [];
      existing.push({ qty: fill.qty, price: fill.price, fees: fill.fees ?? null });
      lots.set(key, existing);
    } else if (fill.side === "SELL") {
      let remainingQty = fill.qty;
      let totalBuyCost = 0;
      let hasCostUnknown = false;
      const feesEstimated = fill.fees === null || fill.tax === null;
      const existingLots = lots.get(key) ?? [];

      while (remainingQty > 0 && existingLots.length > 0) {
        const lot = existingLots[0];
        const matchQty = Math.min(remainingQty, lot.qty);

        totalBuyCost += lot.price * matchQty;

        lot.qty -= matchQty;
        remainingQty -= matchQty;

        if (lot.qty <= 0) {
          existingLots.shift();
        }
      }

      lots.set(key, existingLots);

      // If still remaining qty -> cost unknown (missing opening position)
      if (remainingQty > 0) {
        hasCostUnknown = true;
        const mkKey = `${fill.symbolCode}::${fill.accountType ?? ""}`;
        const existing = missingCostMap.get(mkKey);
        if (existing) {
          existing.shortQty += remainingQty;
        } else {
          missingCostMap.set(mkKey, {
            symbolCode: fill.symbolCode,
            symbolName: fill.symbolName,
            shortQty: remainingQty,
            accountType: fill.accountType ?? "",
          });
        }
      }

      const matchedQty = fill.qty - remainingQty;
      const buyPriceAvg = matchedQty > 0 ? totalBuyCost / matchedQty : null;

      let realizedPnl: number | null = null;
      let reasonIfNull: "UNKNOWN_COST" | undefined;

      if (hasCostUnknown) {
        realizedPnl = null;
        reasonIfNull = "UNKNOWN_COST";
      } else {
        // P&L = (sell_price * qty) - totalBuyCost - fees - tax
        // fees/tax が不明(null)の場合は 0 として概算（feesEstimated=true で注記）
        const sellRevenue = fill.price * fill.qty;
        const sellFees = (fill.fees ?? 0) + (fill.tax ?? 0);
        realizedPnl = sellRevenue - totalBuyCost - sellFees;
      }

      trades.push({
        tradeDate: fill.tradeDate,
        symbolCode: fill.symbolCode,
        symbolName: fill.symbolName,
        side: "SELL",
        qty: fill.qty,
        sellPrice: fill.price,
        buyPriceAvg,
        fees: fill.fees ?? null,
        tax: fill.tax ?? null,
        realizedPnl,
        reasonIfNull,
        feesEstimated,
        accountType: fill.accountType,
      });
    }
    // OTHER side is ignored for P&L
  }

  return {
    trades,
    missingCostSymbols: Array.from(missingCostMap.values()),
  };
}

export function computeSummary(trades: RealizedTrade[]): PnlSummary {
  const calculable = trades.filter((t) => t.realizedPnl !== null);
  const uncalculable = trades.filter((t) => t.realizedPnl === null);

  const wins = calculable.filter((t) => t.realizedPnl! > 0);
  const losses = calculable.filter((t) => t.realizedPnl! < 0);
  const draws = calculable.filter((t) => t.realizedPnl === 0);

  const totalPnl = calculable.reduce((sum, t) => sum + t.realizedPnl!, 0);
  const totalProfit = wins.reduce((sum, t) => sum + t.realizedPnl!, 0);
  const totalLoss = losses.reduce((sum, t) => sum + t.realizedPnl!, 0);

  const avgWin = wins.length > 0 ? totalProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;

  const profitFactor =
    totalLoss !== 0 ? Math.abs(totalProfit / totalLoss) : totalProfit > 0 ? Infinity : null;

  // Max drawdown from cumulative P&L series
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  for (const t of calculable.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))) {
    cumulative += t.realizedPnl!;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    totalPnl,
    winCount: wins.length,
    loseCount: losses.length,
    drawCount: draws.length,
    calculableCount: calculable.length,
    uncalculableCount: uncalculable.length,
    avgWin,
    avgLoss,
    profitFactor,
    maxDrawdown,
    totalProfit,
    totalLoss,
  };
}

export function computeSymbolSummaries(trades: RealizedTrade[]): SymbolSummary[] {
  const map = new Map<string, RealizedTrade[]>();
  for (const t of trades) {
    const existing = map.get(t.symbolCode) ?? [];
    existing.push(t);
    map.set(t.symbolCode, existing);
  }

  const summaries: SymbolSummary[] = [];
  for (const [symbolCode, symTrades] of map) {
    const calculable = symTrades.filter((t) => t.realizedPnl !== null);
    const uncalculable = symTrades.filter((t) => t.realizedPnl === null);
    const wins = calculable.filter((t) => t.realizedPnl! > 0);
    const losses = calculable.filter((t) => t.realizedPnl! < 0);
    const totalPnl = calculable.reduce((sum, t) => sum + t.realizedPnl!, 0);
    summaries.push({
      symbolCode,
      symbolName: symTrades[0].symbolName,
      totalPnl,
      winCount: wins.length,
      loseCount: losses.length,
      tradeCount: symTrades.length,
      avgPnl: calculable.length > 0 ? totalPnl / calculable.length : 0,
      winRate: calculable.length > 0 ? wins.length / calculable.length : 0,
      uncalculableCount: uncalculable.length,
    });
  }

  return summaries.sort((a, b) => b.totalPnl - a.totalPnl);
}

export function getCumulativePnlSeries(
  trades: RealizedTrade[]
): { date: string; cumPnl: number }[] {
  const calculable = trades
    .filter((t) => t.realizedPnl !== null)
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));

  let cum = 0;
  return calculable.map((t) => {
    cum += t.realizedPnl!;
    return { date: t.tradeDate, cumPnl: cum };
  });
}

export function getPnlDistribution(
  trades: RealizedTrade[]
): { range: string; count: number }[] {
  const calculable = trades.filter((t) => t.realizedPnl !== null);
  if (calculable.length === 0) return [];

  const pnls = calculable.map((t) => t.realizedPnl!);
  const min = Math.min(...pnls);
  const max = Math.max(...pnls);

  if (min === max) return [{ range: `${min}`, count: calculable.length }];

  const bucketCount = Math.min(20, calculable.length);
  const step = (max - min) / bucketCount;
  const buckets: { range: string; count: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const lo = min + step * i;
    const hi = min + step * (i + 1);
    const count = pnls.filter((p) =>
      i === bucketCount - 1 ? p >= lo && p <= hi : p >= lo && p < hi
    ).length;
    buckets.push({
      range: `${Math.round(lo / 1000)}k~${Math.round(hi / 1000)}k`,
      count,
    });
  }

  return buckets.filter((b) => b.count > 0);
}
