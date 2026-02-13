import { useState, useMemo, useCallback } from "react";
import type {
  NormalizedFill,
  OpeningPosition,
  ParseResult,
  FilterState,
} from "./lib/types";
import { parseCSV, decodeShiftJIS } from "./lib/parser";
import { calculateRealizedPnl } from "./lib/pnl";
import { FileUploader } from "./components/FileUploader";
import { ParseSummary } from "./components/ParseSummary";
import { Dashboard } from "./components/Dashboard";
import { TradeTable } from "./components/TradeTable";
import { Filters } from "./components/Filters";
import { OpeningPositions } from "./components/OpeningPositions";

type Tab = "dashboard" | "trades" | "positions";
type ViewMode = "mobile" | "desktop";

function App() {
  const [fills, setFills] = useState<NormalizedFill[]>([]);
  const [parseResults, setParseResults] = useState<ParseResult[]>([]);
  const [openingPositions, setOpeningPositions] = useState<OpeningPosition[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    accountType: "",
    symbolSearch: "",
    includeUncalculable: true,
  });

  const handleFilesLoaded = useCallback(async (files: File[]) => {
    const newResults: ParseResult[] = [];
    const allFills: NormalizedFill[] = [];

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const text = decodeShiftJIS(buffer);
      const result = parseCSV(text);
      newResults.push(result);
      allFills.push(...result.fills);
    }

    setParseResults((prev) => [...prev, ...newResults]);
    setFills((prev) => {
      const combined = [...prev, ...allFills];
      combined.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
      return combined;
    });
  }, []);

  const handleClear = useCallback(() => {
    setFills([]);
    setParseResults([]);
  }, []);

  // Filter fills
  const filteredFills = useMemo(() => {
    return fills.filter((f) => {
      if (filters.dateFrom && f.tradeDate < filters.dateFrom) return false;
      if (filters.dateTo && f.tradeDate > filters.dateTo) return false;
      if (filters.accountType && f.accountType !== filters.accountType) return false;
      if (
        filters.symbolSearch &&
        !f.symbolName.includes(filters.symbolSearch) &&
        !f.symbolCode.includes(filters.symbolSearch)
      )
        return false;
      return true;
    });
  }, [fills, filters]);

  // Calculate P&L
  const { trades, missingCostSymbols } = useMemo(() => {
    return calculateRealizedPnl(filteredFills, openingPositions);
  }, [filteredFills, openingPositions]);

  // Filter trades for display
  const displayTrades = useMemo(() => {
    if (filters.includeUncalculable) return trades;
    return trades.filter((t) => t.realizedPnl !== null);
  }, [trades, filters.includeUncalculable]);

  // Extract account types for filter
  const accountTypes = useMemo(() => {
    const set = new Set<string>();
    fills.forEach((f) => {
      if (f.accountType) set.add(f.accountType);
    });
    return Array.from(set).sort();
  }, [fills]);

  const tabClass = (tab: Tab) =>
    `${viewMode === "mobile" ? "px-3 py-2 text-xs" : "px-4 py-2 text-sm"} font-medium rounded-t-lg transition-colors ${
      activeTab === tab
        ? "bg-white text-gray-900 border-b-2 border-blue-500"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
            取引損益ビューア
              </h1>
              <p className="text-sm text-gray-500 mt-1">
            SBI証券 約定履歴CSVを読み込み、実現損益を可視化します
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode("mobile")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "mobile"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                スマホ対応モード
              </button>
              <button
                type="button"
                onClick={() => setViewMode("desktop")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "desktop"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                デスクトップ対応モード
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-7xl mx-auto px-4 py-6 space-y-6 ${viewMode === "mobile" ? "max-w-3xl" : ""}`}>
        {/* Upload Area */}
        <FileUploader onFilesLoaded={handleFilesLoaded} onClear={handleClear} hasData={fills.length > 0} />

        {/* Parse Summary */}
        {parseResults.length > 0 && (
          <ParseSummary results={parseResults} />
        )}

        {fills.length > 0 && (
          <>
            {/* Filters */}
            <Filters
              filters={filters}
              onChange={setFilters}
              accountTypes={accountTypes}
              viewMode={viewMode}
            />

            {/* Tabs */}
            <div className="flex gap-2">
              <button className={tabClass("dashboard")} onClick={() => setActiveTab("dashboard")}>
                ダッシュボード
              </button>
              <button className={tabClass("trades")} onClick={() => setActiveTab("trades")}>
                取引一覧
              </button>
              <button className={tabClass("positions")} onClick={() => setActiveTab("positions")}>
                期首ポジション
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === "dashboard" && (
              <Dashboard
                trades={displayTrades}
                missingCostSymbols={missingCostSymbols}
              />
            )}

            {activeTab === "trades" && (
              <TradeTable trades={displayTrades} viewMode={viewMode} />
            )}

            {activeTab === "positions" && (
              <OpeningPositions
                positions={openingPositions}
                onChange={setOpeningPositions}
                missingCostSymbols={missingCostSymbols}
                viewMode={viewMode}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
