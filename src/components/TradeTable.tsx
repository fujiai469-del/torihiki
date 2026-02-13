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
      return "原価不明（期首保有が必要）";
    case "UNKNOWN_FEES_TAX":
      return "手数料/税不明";
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">
        取引一覧 ({trades.length}件)
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th
                className="text-left py-2 px-2 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("tradeDate")}
              >
                約定日{sortIndicator("tradeDate")}
              </th>
              <th
                className="text-left py-2 px-2 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("symbolName")}
              >
                銘柄{sortIndicator("symbolName")}
              </th>
              <th className="text-left py-2 px-2">コード</th>
              <th className="text-left py-2 px-2">口座</th>
              <th
                className="text-right py-2 px-2 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("qty")}
              >
                数量{sortIndicator("qty")}
              </th>
              <th
                className="text-right py-2 px-2 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("sellPrice")}
              >
                売単価{sortIndicator("sellPrice")}
              </th>
              <th className="text-right py-2 px-2">買平均</th>
              <th className="text-right py-2 px-2">手数料</th>
              <th className="text-right py-2 px-2">税</th>
              <th
                className="text-right py-2 px-2 cursor-pointer hover:text-blue-600"
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
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  t.realizedPnl === null ? "bg-amber-50" : ""
                }`}
              >
                <td className="py-2 px-2">{t.tradeDate}</td>
                <td className="py-2 px-2">{t.symbolName}</td>
                <td className="py-2 px-2 text-gray-500">{t.symbolCode}</td>
                <td className="py-2 px-2 text-gray-500 text-xs">
                  {t.accountType ?? "---"}
                </td>
                <td className="py-2 px-2 text-right">
                  {t.qty.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right">
                  {formatYen(t.sellPrice)}
                </td>
                <td className="py-2 px-2 text-right">
                  {t.buyPriceAvg !== null
                    ? formatYen(Math.round(t.buyPriceAvg))
                    : "不明"}
                </td>
                <td className="py-2 px-2 text-right text-gray-500">
                  {t.fees !== null ? formatYen(t.fees) : "不明"}
                </td>
                <td className="py-2 px-2 text-right text-gray-500">
                  {t.tax !== null ? formatYen(t.tax) : "不明"}
                </td>
                <td className="py-2 px-2 text-right font-medium">
                  {t.realizedPnl !== null ? (
                    <span
                      className={
                        t.realizedPnl >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {formatYen(t.realizedPnl)}
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
          <div className="text-center py-8 text-gray-400">
            SELL取引がありません
          </div>
        )}
      </div>
    </div>
  );
}
