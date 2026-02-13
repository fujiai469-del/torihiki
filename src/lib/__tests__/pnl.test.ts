import { describe, it, expect } from "vitest";
import { calculateRealizedPnl, computeSummary } from "../pnl";
import type { NormalizedFill, OpeningPosition } from "../types";

function makeFill(params: {
  tradeDate?: string;
  symbolCode: string;
  symbolName?: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  fees?: number | null;
  tax?: number | null;
  accountType?: string;
}): NormalizedFill {
  return {
    tradeDate: params.tradeDate ?? "2024-01-15",
    symbolName: params.symbolName ?? "テスト銘柄",
    symbolCode: params.symbolCode,
    side: params.side,
    qty: params.qty,
    price: params.price,
    fees: params.fees !== undefined ? params.fees : 0,
    tax: params.tax !== undefined ? params.tax : 0,
    accountType: params.accountType ?? "特定",
    raw: {},
  };
}

describe("calculateRealizedPnl", () => {
  it("通常ケース: 買って売ってFIFO損益が正しい", () => {
    const fills: NormalizedFill[] = [
      makeFill({ tradeDate: "2024-01-10", symbolCode: "1234", side: "BUY", qty: 100, price: 1000, fees: 100, tax: 0 }),
      makeFill({ tradeDate: "2024-01-15", symbolCode: "1234", side: "SELL", qty: 100, price: 1200, fees: 100, tax: 200 }),
    ];

    const { trades, missingCostSymbols } = calculateRealizedPnl(fills);

    expect(trades).toHaveLength(1);
    expect(trades[0].realizedPnl).not.toBeNull();
    // (1200 - 1000) * 100 - 100(sell fees) - 200(sell tax) = 20000 - 300 = 19700
    expect(trades[0].realizedPnl).toBe(19700);
    expect(trades[0].reasonIfNull).toBeUndefined();
    expect(missingCostSymbols).toHaveLength(0);
  });

  it("FIFO順序: 先に買ったロットから消化", () => {
    const fills: NormalizedFill[] = [
      makeFill({ tradeDate: "2024-01-10", symbolCode: "1234", side: "BUY", qty: 100, price: 1000, fees: 0, tax: 0 }),
      makeFill({ tradeDate: "2024-01-11", symbolCode: "1234", side: "BUY", qty: 100, price: 1500, fees: 0, tax: 0 }),
      makeFill({ tradeDate: "2024-01-15", symbolCode: "1234", side: "SELL", qty: 150, price: 1300, fees: 0, tax: 0 }),
    ];

    const { trades } = calculateRealizedPnl(fills);

    expect(trades).toHaveLength(1);
    // First 100 shares at 1000, next 50 shares at 1500
    // Cost = 100*1000 + 50*1500 = 175000
    // Revenue = 150*1300 = 195000
    // PnL = 195000 - 175000 = 20000
    expect(trades[0].realizedPnl).toBe(20000);
  });

  it("原価不明: BUYロット不足でrealizedPnl=nullかつUNKNOWN_COST", () => {
    const fills: NormalizedFill[] = [
      // SELL without any preceding BUY
      makeFill({ tradeDate: "2024-01-15", symbolCode: "1234", side: "SELL", qty: 100, price: 1200, fees: 100, tax: 0 }),
    ];

    const { trades, missingCostSymbols } = calculateRealizedPnl(fills);

    expect(trades).toHaveLength(1);
    expect(trades[0].realizedPnl).toBeNull();
    expect(trades[0].reasonIfNull).toBe("UNKNOWN_COST");
    expect(missingCostSymbols).toHaveLength(1);
    expect(missingCostSymbols[0].shortQty).toBe(100);
  });

  it("fees/tax不明: 0として概算し feesEstimated=true", () => {
    const fills: NormalizedFill[] = [
      makeFill({ tradeDate: "2024-01-10", symbolCode: "1234", side: "BUY", qty: 100, price: 1000, fees: 0, tax: 0 }),
      makeFill({ tradeDate: "2024-01-15", symbolCode: "1234", side: "SELL", qty: 100, price: 1200, fees: null, tax: null }),
    ];

    const { trades } = calculateRealizedPnl(fills);

    expect(trades).toHaveLength(1);
    // fees/tax不明でも計算はされる（0として概算）
    expect(trades[0].realizedPnl).toBe(20000); // (1200-1000)*100 - 0 - 0
    expect(trades[0].feesEstimated).toBe(true);
    expect(trades[0].reasonIfNull).toBeUndefined();
  });

  it("期首ポジションを投入すると原価不明が解消される", () => {
    const fills: NormalizedFill[] = [
      makeFill({ tradeDate: "2024-01-15", symbolCode: "1234", side: "SELL", qty: 100, price: 1200, fees: 100, tax: 0 }),
    ];

    const openingPositions: OpeningPosition[] = [
      { id: "op1", symbolCode: "1234", symbolName: "テスト銘柄", qty: 100, avgCost: 1000, accountType: "特定" },
    ];

    const { trades, missingCostSymbols } = calculateRealizedPnl(fills, openingPositions);

    expect(trades).toHaveLength(1);
    expect(trades[0].realizedPnl).not.toBeNull();
    // (1200 - 1000) * 100 - 100 = 19900
    expect(trades[0].realizedPnl).toBe(19900);
    expect(missingCostSymbols).toHaveLength(0);
  });

  it("口座区分(accountType)を別管理する", () => {
    const fills: NormalizedFill[] = [
      makeFill({ tradeDate: "2024-01-10", symbolCode: "1234", side: "BUY", qty: 100, price: 1000, fees: 0, tax: 0, accountType: "特定" }),
      // SELL in NISA, but no BUY in NISA
      makeFill({ tradeDate: "2024-01-15", symbolCode: "1234", side: "SELL", qty: 100, price: 1200, fees: 0, tax: 0, accountType: "NISA" }),
    ];

    const { trades, missingCostSymbols } = calculateRealizedPnl(fills);

    expect(trades).toHaveLength(1);
    expect(trades[0].realizedPnl).toBeNull();
    expect(trades[0].reasonIfNull).toBe("UNKNOWN_COST");
    expect(missingCostSymbols).toHaveLength(1);
    expect(missingCostSymbols[0].accountType).toBe("NISA");
  });
});

describe("computeSummary", () => {
  it("fees不明でも概算で計算され集計に含まれる", () => {
    const { trades } = calculateRealizedPnl([
      makeFill({ tradeDate: "2024-01-10", symbolCode: "1234", side: "BUY", qty: 100, price: 1000, fees: 0, tax: 0 }),
      makeFill({ tradeDate: "2024-01-15", symbolCode: "1234", side: "SELL", qty: 100, price: 1200, fees: 0, tax: 0 }),
      // Another trade with unknown fees - now calculated as estimate
      makeFill({ tradeDate: "2024-01-10", symbolCode: "5678", side: "BUY", qty: 50, price: 2000, fees: 0, tax: 0 }),
      makeFill({ tradeDate: "2024-01-20", symbolCode: "5678", side: "SELL", qty: 50, price: 1800, fees: null, tax: null }),
    ]);

    const summary = computeSummary(trades);

    // Both trades are now calculable (fees-unknown treated as 0)
    expect(summary.calculableCount).toBe(2);
    expect(summary.uncalculableCount).toBe(0);
    // 20000 + (1800-2000)*50 = 20000 + (-10000) = 10000
    expect(summary.totalPnl).toBe(10000);
    expect(summary.winCount).toBe(1);
    expect(summary.loseCount).toBe(1);
  });

  it("原価不明のみが計算不可になる", () => {
    const { trades } = calculateRealizedPnl([
      // SELL without BUY -> unknown cost
      makeFill({ tradeDate: "2024-01-15", symbolCode: "9999", side: "SELL", qty: 10, price: 500, fees: 0, tax: 0 }),
    ]);

    const summary = computeSummary(trades);
    expect(summary.calculableCount).toBe(0);
    expect(summary.uncalculableCount).toBe(1);
  });
});
