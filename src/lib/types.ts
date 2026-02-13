export type NormalizedFill = {
  tradeDate: string;       // ISO yyyy-mm-dd
  symbolName: string;
  symbolCode: string;
  market?: string;
  side: "BUY" | "SELL" | "OTHER";
  qty: number;
  price: number;
  fees?: number | null;    // null=不明
  tax?: number | null;     // null=不明
  accountType?: string;    // 預り（特定/NISAなど）
  deliveryDate?: string;
  deliveryAmount?: number | null;
  raw: Record<string, string>;
};

export type RealizedTrade = {
  tradeDate: string;
  symbolCode: string;
  symbolName: string;
  side: "SELL";
  qty: number;
  sellPrice: number;
  buyPriceAvg: number | null;
  fees: number | null;
  tax: number | null;
  realizedPnl: number | null;
  reasonIfNull?: "UNKNOWN_COST";
  feesEstimated: boolean;       // true=手数料/税が不明のため0として概算
  accountType?: string;
};

export type OpeningPosition = {
  id: string;
  symbolCode: string;
  symbolName: string;
  qty: number;
  avgCost: number;
  accountType: string;
};

export type ParseResult = {
  fills: NormalizedFill[];
  totalRows: number;
  successRows: number;
  failedRows: number;
  unknownFieldCount: number;
  errors: string[];
};

export type FifoLot = {
  qty: number;
  price: number;
  fees: number | null;
};

export type PnlSummary = {
  totalPnl: number;
  winCount: number;
  loseCount: number;
  drawCount: number;
  calculableCount: number;
  uncalculableCount: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  maxDrawdown: number;
  totalProfit: number;
  totalLoss: number;
};

export type SymbolSummary = {
  symbolCode: string;
  symbolName: string;
  totalPnl: number;
  winCount: number;
  loseCount: number;
  tradeCount: number;
  avgPnl: number;
  winRate: number;
};

export type FilterState = {
  dateFrom: string;
  dateTo: string;
  accountType: string;
  symbolSearch: string;
  includeUncalculable: boolean;
};
