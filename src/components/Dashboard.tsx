import { useMemo, useState } from "react";
import type { RealizedTrade, OpeningPosition } from "../lib/types";
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

type MissingCostSymbol = {
  symbolCode: string;
  symbolName: string;
  shortQty: number;
  accountType: string;
};

type Props = {
  trades: RealizedTrade[];
  missingCostSymbols: MissingCostSymbol[];
  onAddPosition?: (position: Omit<OpeningPosition, "id">) => void;
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
    <div className="bg-white rounded-lg shadow-sm border border-claude-border p-4">
      <div className="text-xs text-claude-text-secondary mb-1 whitespace-nowrap">{label}</div>
      <div className={`text-lg font-bold whitespace-nowrap ${color ?? "text-claude-text"}`}>{value}</div>
      {sub && <div className="text-xs text-claude-text-secondary mt-1 whitespace-nowrap">{sub}</div>}
    </div>
  );
}

function MissingCostForm({
  symbol,
  onSubmit,
}: {
  symbol: MissingCostSymbol;
  onSubmit: (position: Omit<OpeningPosition, "id">) => void;
}) {
  const [symbolName, setSymbolName] = useState(symbol.symbolName);
  const [avgCost, setAvgCost] = useState("");

  const handleSubmit = () => {
    const cost = Number(avgCost);
    if (isNaN(cost) || cost <= 0) {
      alert("取得単価を正の数で入力してください");
      return;
    }
    onSubmit({
      symbolCode: symbol.symbolCode,
      symbolName: symbolName || symbol.symbolCode,
      qty: symbol.shortQty,
      avgCost: cost,
      accountType: symbol.accountType,
    });
    setAvgCost("");
  };

  return (
    <div className="bg-white border border-claude-terra-light rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-claude-terra-dark">
          {symbol.symbolCode}
        </span>
        <span className="text-xs text-claude-terra">{symbol.shortQty}株</span>
        {symbol.accountType && (
          <span className="text-xs bg-claude-terra-light text-claude-terra-dark px-1.5 py-0.5 rounded">
            {symbol.accountType}
          </span>
        )}
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 min-w-0">
          <label className="text-xs text-claude-terra block mb-0.5">銘柄名</label>
          <input
            type="text"
            value={symbolName}
            onChange={(e) => setSymbolName(e.target.value)}
            className="border border-claude-border rounded px-2 py-1.5 text-sm w-full bg-white focus:border-claude-terra focus:outline-none"
            placeholder="銘柄名"
          />
        </div>
        <div className="w-full sm:w-32 shrink-0">
          <label className="text-xs text-claude-terra block mb-0.5">取得単価 (円)</label>
          <input
            type="number"
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            className="border border-claude-border rounded px-2 py-1.5 text-sm w-full bg-white focus:border-claude-terra focus:outline-none"
            placeholder="例: 1500"
            min="0"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
        <div className="shrink-0 sm:self-end">
          <button
            onClick={handleSubmit}
            className="bg-claude-terra text-white px-4 py-1.5 rounded text-sm hover:bg-claude-terra-dark transition-colors w-full sm:w-auto"
          >
            登録
          </button>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ trades, missingCostSymbols, onAddPosition }: Props) {
  const summary = useMemo(() => computeSummary(trades), [trades]);
  const symbolSummaries = useMemo(() => computeSymbolSummaries(trades), [trades]);
  const cumSeries = useMemo(() => getCumulativePnlSeries(trades), [trades]);

  const tradePnlBars = useMemo(() => {
    return trades
      .filter((t) => t.realizedPnl !== null)
      .map((t, i) => ({
        idx: i + 1,
        pnl: t.realizedPnl!,
        label: `${t.symbolName} (${t.tradeDate})`,
      }));
  }, [trades]);

  const topSymbols = useMemo(() => symbolSummaries.slice(0, 10), [symbolSummaries]);
  const bottomSymbols = useMemo(() => {
    const sorted = [...symbolSummaries].sort((a, b) => a.totalPnl - b.totalPnl);
    return sorted.slice(0, 10);
  }, [symbolSummaries]);

  const symbolRanking = useMemo(() => {
    const map = new Map<string, (typeof symbolSummaries)[0]>();
    [...topSymbols, ...bottomSymbols].forEach((s) => map.set(s.symbolCode, s));
    return Array.from(map.values()).sort((a, b) => b.totalPnl - a.totalPnl);
  }, [topSymbols, bottomSymbols]);

  if (trades.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-claude-border p-8 text-center text-claude-text-secondary">
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
          label="最大DD"
          value={formatYen(summary.maxDrawdown)}
          color="text-red-600"
        />
      </div>

      {/* Fees estimated info */}
      {trades.some((t) => t.feesEstimated && t.realizedPnl !== null) && (
        <div className="bg-claude-terra-light/40 border border-claude-terra-light rounded-lg p-3">
          <p className="text-sm text-claude-terra-dark">
            手数料/税額がCSVで「--」の取引は、手数料・税を0円として概算しています（SBI証券ゼロ革命/NISA非課税を想定）。
            取引一覧の損益に「*」が付いた取引が該当します。
          </p>
        </div>
      )}

      {/* Uncalculable / Missing Cost */}
      {(summary.uncalculableCount > 0 || missingCostSymbols.length > 0) && (
        <div className="bg-claude-terra-light/30 border border-claude-terra-light rounded-lg p-4">
          <h4 className="text-sm font-semibold text-claude-terra-dark mb-2">
            取得単価の入力が必要な銘柄があります
          </h4>
          <p className="text-sm text-claude-terra mb-3">
            {summary.uncalculableCount}件の取引で原価が不明です（CSV期間外の買付データが必要）。
            以下で取得単価を入力すると損益が再計算されます。
          </p>
          {missingCostSymbols.length > 0 && onAddPosition && (
            <div className="space-y-2">
              {missingCostSymbols.map((s) => (
                <MissingCostForm
                  key={`${s.symbolCode}-${s.accountType}`}
                  symbol={s}
                  onSubmit={onAddPosition}
                />
              ))}
            </div>
          )}
          {missingCostSymbols.length > 0 && !onAddPosition && (
            <p className="text-xs text-claude-terra mt-1">
              「期首ポジション」タブで取得単価を入力すると再計算されます。
            </p>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative P&L */}
        <div className="bg-white rounded-lg shadow-sm border border-claude-border p-4">
          <h4 className="text-sm font-semibold text-claude-text mb-3">
            累積実現損益（時系列）
          </h4>
          {cumSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cumSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0DBD5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#6B6560" }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10, fill: "#6B6560" }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                <Tooltip
                  formatter={(value: number) => [formatYen(value), "累積損益"]}
                />
                <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="cumPnl"
                  stroke="#D97757"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-claude-text-secondary text-sm">
              データなし
            </div>
          )}
        </div>

        {/* Trade P&L histogram */}
        <div className="bg-white rounded-lg shadow-sm border border-claude-border p-4">
          <h4 className="text-sm font-semibold text-claude-text mb-3">
            取引別損益
          </h4>
          {tradePnlBars.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tradePnlBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0DBD5" />
                <XAxis dataKey="idx" tick={{ fontSize: 10, fill: "#6B6560" }} />
                <YAxis tick={{ fontSize: 10, fill: "#6B6560" }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
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
            <div className="h-[300px] flex items-center justify-center text-claude-text-secondary text-sm">
              データなし
            </div>
          )}
        </div>

        {/* Symbol Ranking */}
        <div className="bg-white rounded-lg shadow-sm border border-claude-border p-4 lg:col-span-2">
          <h4 className="text-sm font-semibold text-claude-text mb-3">
            銘柄別実現損益ランキング
          </h4>
          {symbolRanking.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, symbolRanking.length * 30)}>
              <BarChart
                data={symbolRanking}
                layout="vertical"
                margin={{ left: 120 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E0DBD5" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#6B6560" }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                <YAxis
                  type="category"
                  dataKey="symbolName"
                  tick={{ fontSize: 10, fill: "#6B6560" }}
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
                      fill={
                        entry.uncalculableCount > 0 && entry.tradeCount === entry.uncalculableCount
                          ? "#D97757"
                          : entry.totalPnl >= 0
                            ? "#16a34a"
                            : "#dc2626"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-claude-text-secondary text-sm">
              データなし
            </div>
          )}
        </div>
      </div>

      {/* Symbol Summary Table */}
      <div className="bg-white rounded-lg shadow-sm border border-claude-border p-4">
        <h4 className="text-sm font-semibold text-claude-text mb-3">
          銘柄別サマリ
        </h4>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr className="border-b-2 border-claude-border">
                <th className="text-left py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">銘柄</th>
                <th className="text-left py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">コード</th>
                <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">損益</th>
                <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">勝率</th>
                <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">取引数</th>
                <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">平均損益</th>
                <th className="text-center py-2.5 px-3 whitespace-nowrap font-semibold text-claude-text">状態</th>
              </tr>
            </thead>
            <tbody>
              {symbolSummaries.map((s) => (
                <tr
                  key={s.symbolCode}
                  className={`border-b border-claude-border-light hover:bg-claude-cream ${
                    s.uncalculableCount > 0 ? "bg-claude-terra-light/30" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 whitespace-nowrap">{s.symbolName}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-claude-text-secondary">{s.symbolCode}</td>
                  <td
                    className={`py-2.5 px-3 text-right whitespace-nowrap font-medium ${
                      s.uncalculableCount > 0 && s.tradeCount === s.uncalculableCount
                        ? "text-claude-terra"
                        : s.totalPnl >= 0
                          ? "text-green-600"
                          : "text-red-600"
                    }`}
                  >
                    {s.uncalculableCount > 0 && s.tradeCount === s.uncalculableCount
                      ? "要入力"
                      : formatYen(s.totalPnl)}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {s.uncalculableCount > 0 && s.tradeCount === s.uncalculableCount
                      ? "---"
                      : formatPct(s.winRate)}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">{s.tradeCount}</td>
                  <td
                    className={`py-2.5 px-3 text-right whitespace-nowrap ${
                      s.uncalculableCount > 0 && s.tradeCount === s.uncalculableCount
                        ? "text-claude-terra"
                        : s.avgPnl >= 0
                          ? "text-green-600"
                          : "text-red-600"
                    }`}
                  >
                    {s.uncalculableCount > 0 && s.tradeCount === s.uncalculableCount
                      ? "---"
                      : formatYen(s.avgPnl)}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {s.uncalculableCount > 0 ? (
                      <span className="text-xs text-claude-terra-dark bg-claude-terra-light px-2 py-0.5 rounded-full">
                        {s.uncalculableCount}件 要入力
                      </span>
                    ) : (
                      <span className="text-xs text-green-600">OK</span>
                    )}
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
