import { useState, useMemo, useCallback } from "react";
import type {
  NormalizedFill,
  OpeningPosition,
  ParseResult,
  FilterState,
} from "./lib/types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
import { parseCSV, decodeShiftJIS } from "./lib/parser";
import { calculateRealizedPnl } from "./lib/pnl";
import { FileUploader } from "./components/FileUploader";
import { ParseSummary } from "./components/ParseSummary";
import { Dashboard } from "./components/Dashboard";
import { TradeTable } from "./components/TradeTable";
import { Filters } from "./components/Filters";
import { OpeningPositions } from "./components/OpeningPositions";

type Tab = "dashboard" | "trades" | "positions";

function App() {
  const [fills, setFills] = useState<NormalizedFill[]>([]);
  const [parseResults, setParseResults] = useState<ParseResult[]>([]);
  const [openingPositions, setOpeningPositions] = useState<OpeningPosition[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
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

  const handleAddPosition = useCallback(
    (pos: Omit<OpeningPosition, "id">) => {
      const newPos: OpeningPosition = { ...pos, id: generateId() };
      setOpeningPositions((prev) => [...prev, newPos]);
    },
    []
  );

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
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      activeTab === tab
        ? "bg-white text-gray-900 border-b-2 border-blue-500"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              取引損益ビューア
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              SBI証券 約定履歴CSVを読み込み、実現損益を可視化します
            </p>
          </div>
          <a
            href="https://fujiai469-del.github.io/torihiki/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-700 hover:underline transition-colors shrink-0 ml-4"
          >
            fujiai469-del.github.io/torihiki
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
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
                onAddPosition={handleAddPosition}
              />
            )}

            {activeTab === "trades" && (
              <TradeTable trades={displayTrades} />
            )}

            {activeTab === "positions" && (
              <OpeningPositions
                positions={openingPositions}
                onChange={setOpeningPositions}
                missingCostSymbols={missingCostSymbols}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
