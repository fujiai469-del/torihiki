import { useMemo } from "react";
import type { RealizedTrade } from "../lib/types";
import {
  computeSummary,
  computeSymbolSummaries,
  getCumulativePnlSeries,
} from "../lib/pnl";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

type Props = {
  trades: RealizedTrade[];
  missingCostSymbols: {
    symbolCode: string;
    symbolName: string;
    shortQty: number;
    accountType: string;
  }[];
};

function formatYen(n: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color ?? "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export function Dashboard({ trades, missingCostSymbols }: Props) {
  const summary = useMemo(() => computeSummary(trades), [trades]);
  const symbolSummaries = useMemo(() => computeSymbolSummaries(trades), [trades]);
  const cumSeries = useMemo(() => getCumulativePnlSeries(trades), [trades]);
  // distribution is available for future histogram use
  // const distribution = useMemo(() => getPnlDistribution(trades), [trades]);

  // Per-trade P&L for bar chart
  const tradePnlBars = useMemo(() => {
    return trades
      .filter((t) => t.realizedPnl !== null)
      .map((t, i) => ({
        idx: i + 1,
        pnl: t.realizedPnl!,
        label: `${t.symbolName} (${t.tradeDate})`,
      }));
  }, [trades]);

  // Symbol ranking top 10
  const topSymbols = useMemo(() => symbolSummaries.slice(0, 10), [symbolSummaries]);
  const bottomSymbols = useMemo(() => {
    const sorted = [...symbolSummaries].sort((a, b) => a.totalPnl - b.totalPnl);
    return sorted.slice(0, 10);
  }, [symbolSummaries]);

  const symbolRanking = useMemo(() => {
    // Combine top and bottom, dedup
    const map = new Map<string, (typeof symbolSummaries)[0]>();
    [...topSymbols, ...bottomSymbols].forEach((s) => map.set(s.symbolCode, s));
    return Array.from(map.values()).sort((a, b) => b.totalPnl - a.totalPnl);
  }, [topSymbols, bottomSymbols]);

  if (trades.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        SELL取引がありません。BUY取引のみの場合、売却時に損益が計算されます。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="実現損益合計"
          value={formatYen(summary.totalPnl)}
          color={summary.totalPnl >= 0 ? "text-green-600" : "text-red-600"}
          sub={`計算可能 ${summary.calculableCount}件`}
        />
        <KpiCard
          label="勝率"
          value={
            summary.calculableCount > 0
              ? formatPct(summary.winCount / summary.calculableCount)
              : "計算不可"
          }
          sub={`${summary.winCount}勝 ${summary.loseCount}敗 ${summary.drawCount}分`}
        />
        <KpiCard
          label="平均利益"
          value={summary.winCount > 0 ? formatYen(summary.avgWin) : "---"}
          color="text-green-600"
        />
        <KpiCard
          label="平均損失"
          value={summary.loseCount > 0 ? formatYen(summary.avgLoss) : "---"}
          color="text-red-600"
        />
        <KpiCard
          label="Profit Factor"
          value={
            summary.profitFactor === null
              ? "計算不可"
              : summary.profitFactor === Infinity
                ? "---"
                : summary.profitFactor.toFixed(2)
          }
          sub={`利益${formatYen(summary.totalProfit)} / 損失${formatYen(Math.abs(summary.totalLoss))}`}
        />
        <KpiCard
          label="最大ドローダウン"
          value={formatYen(summary.maxDrawdown)}
          color="text-red-600"
        />
      </div>

      {/* Uncalculable / Missing Cost warnings */}
      {(summary.uncalculableCount > 0 || missingCostSymbols.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-amber-800 mb-2">
            注意: 計算不可トレード
          </h4>
          {summary.uncalculableCount > 0 && (
            <p className="text-sm text-amber-700">
              {summary.uncalculableCount}件の取引が計算不可です（原価不明/手数料・税不明）。
              集計値にはこれらは含まれていません。
            </p>
          )}
          {missingCostSymbols.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-amber-700 font-medium">
                期首保有が必要な銘柄:
              </p>
              <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                {missingCostSymbols.map((s) => (
                  <li key={`${s.symbolCode}-${s.accountType}`}>
                    {s.symbolName} ({s.symbolCode}) - 不足数量: {s.shortQty}株
                    {s.accountType && ` [${s.accountType}]`}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-600 mt-1">
                「期首ポジション」タブで取得単価を入力すると再計算されます。
              </p>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative P&L */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            累積実現損益（時系列）
          </h4>
          {cumSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cumSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                <Tooltip
                  formatter={(value: number) => [formatYen(value), "累積損益"]}
                />
                <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="cumPnl"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              データなし
            </div>
          )}
        </div>

        {/* Trade P&L histogram */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            取引別損益
          </h4>
          {tradePnlBars.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tradePnlBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="idx" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                <Tooltip
                  formatter={(value: number) => [formatYen(value), "損益"]}
                  labelFormatter={(label) => {
                    const item = tradePnlBars[Number(label) - 1];
                    return item?.label ?? "";
                  }}
                />
                <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
                <Bar dataKey="pnl">
                  {tradePnlBars.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.pnl >= 0 ? "#16a34a" : "#dc2626"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              データなし
            </div>
          )}
        </div>

        {/* Symbol Ranking */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:col-span-2">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            銘柄別実現損益ランキング
          </h4>
          {symbolRanking.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, symbolRanking.length * 30)}>
              <BarChart
                data={symbolRanking}
                layout="vertical"
                margin={{ left: 120 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                <YAxis
                  type="category"
                  dataKey="symbolName"
                  tick={{ fontSize: 10 }}
                  width={110}
                />
                <Tooltip
                  formatter={(value: number) => [formatYen(value), "損益"]}
                />
                <ReferenceLine x={0} stroke="#999" strokeDasharray="3 3" />
                <Bar dataKey="totalPnl">
                  {symbolRanking.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.totalPnl >= 0 ? "#16a34a" : "#dc2626"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              データなし
            </div>
          )}
        </div>
      </div>

      {/* Symbol Summary Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          銘柄別サマリ
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2">銘柄</th>
                <th className="text-left py-2 px-2">コード</th>
                <th className="text-right py-2 px-2">損益</th>
                <th className="text-right py-2 px-2">勝率</th>
                <th className="text-right py-2 px-2">取引数</th>
                <th className="text-right py-2 px-2">平均損益</th>
              </tr>
            </thead>
            <tbody>
              {symbolSummaries.map((s) => (
                <tr
                  key={s.symbolCode}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-2 px-2">{s.symbolName}</td>
                  <td className="py-2 px-2 text-gray-500">{s.symbolCode}</td>
                  <td
                    className={`py-2 px-2 text-right font-medium ${
                      s.totalPnl >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatYen(s.totalPnl)}
                  </td>
                  <td className="py-2 px-2 text-right">{formatPct(s.winRate)}</td>
                  <td className="py-2 px-2 text-right">{s.tradeCount}</td>
                  <td
                    className={`py-2 px-2 text-right ${
                      s.avgPnl >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatYen(s.avgPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
