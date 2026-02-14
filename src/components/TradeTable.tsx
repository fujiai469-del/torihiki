import { useState, useMemo } from "react";
import type { RealizedTrade } from "../lib/types";

type Props = {
  trades: RealizedTrade[];
};

type SortKey = "tradeDate" | "symbolName" | "qty" | "sellPrice" | "realizedPnl";
type SortDir = "asc" | "desc";

function formatYen(n: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

function reasonLabel(reason?: string): string {
  switch (reason) {
    case "UNKNOWN_COST":
      return "原価不明";
    default:
      return "計算不可";
  }
}

export function TradeTable({ trades }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("tradeDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...trades];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "tradeDate":
          cmp = a.tradeDate.localeCompare(b.tradeDate);
          break;
        case "symbolName":
          cmp = a.symbolName.localeCompare(b.symbolName);
          break;
        case "qty":
          cmp = a.qty - b.qty;
          break;
        case "sellPrice":
          cmp = a.sellPrice - b.sellPrice;
          break;
        case "realizedPnl":
          cmp = (a.realizedPnl ?? -Infinity) - (b.realizedPnl ?? -Infinity);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [trades, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-claude-border p-4">
      <h4 className="text-sm font-semibold text-claude-text mb-3">
        取引一覧 ({trades.length}件)
      </h4>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm" style={{ minWidth: 800 }}>
          <thead>
            <tr className="border-b-2 border-claude-border">
              <th
                className="text-left py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-claude-terra font-semibold text-claude-text"
                onClick={() => toggleSort("tradeDate")}
              >
                約定日{sortIndicator("tradeDate")}
              </th>
              <th
                className="text-left py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-claude-terra font-semibold text-claude-text"
                onClick={() => toggleSort("symbolName")}
              >
                銘柄{sortIndicator("symbolName")}
              </th>
              <th className="text-left py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">コード</th>
              <th className="text-left py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">口座</th>
              <th
                className="text-right py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-claude-terra font-semibold text-claude-text"
                onClick={() => toggleSort("qty")}
              >
                数量{sortIndicator("qty")}
              </th>
              <th
                className="text-right py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-claude-terra font-semibold text-claude-text"
                onClick={() => toggleSort("sellPrice")}
              >
                売単価{sortIndicator("sellPrice")}
              </th>
              <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">買平均</th>
              <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">手数料</th>
              <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">税</th>
              <th
                className="text-right py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-claude-terra font-semibold text-claude-text"
                onClick={() => toggleSort("realizedPnl")}
              >
                損益{sortIndicator("realizedPnl")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr
                key={i}
                className={`border-b border-claude-border-light hover:bg-claude-cream ${
                  t.realizedPnl === null ? "bg-claude-terra-light/30" : ""
                }`}
              >
                <td className="py-2.5 px-3 whitespace-nowrap">{t.tradeDate}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">{t.symbolName}</td>
                <td className="py-2.5 px-3 whitespace-nowrap text-claude-text-secondary">{t.symbolCode}</td>
                <td className="py-2.5 px-3 whitespace-nowrap text-claude-text-secondary text-xs">
                  {t.accountType ?? "---"}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {t.qty.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {formatYen(t.sellPrice)}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {t.buyPriceAvg !== null
                    ? formatYen(Math.round(t.buyPriceAvg))
                    : "不明"}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap text-claude-text-secondary">
                  {t.fees !== null ? formatYen(t.fees) : "不明"}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap text-claude-text-secondary">
                  {t.tax !== null ? formatYen(t.tax) : "不明"}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium">
                  {t.realizedPnl !== null ? (
                    <span>
                      <span
                        className={
                          t.realizedPnl >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {formatYen(t.realizedPnl)}
                      </span>
                      {t.feesEstimated && (
                        <span className="text-claude-text-secondary text-xs ml-1" title="手数料/税が不明のため0として概算">*</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-amber-600 text-xs">
                      {reasonLabel(t.reasonIfNull)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {trades.length === 0 && (
          <div className="text-center py-8 text-claude-text-secondary">
            SELL取引がありません
          </div>
        )}
      </div>
    </div>
  );
}
