import { useState } from "react";
import type { OpeningPosition } from "../lib/types";

type ViewMode = "mobile" | "desktop";

type Props = {
  positions: OpeningPosition[];
  onChange: (positions: OpeningPosition[]) => void;
  viewMode: ViewMode;
  missingCostSymbols: {
    symbolCode: string;
    symbolName: string;
    shortQty: number;
    accountType: string;
  }[];
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function OpeningPositions({
  positions,
  onChange,
  missingCostSymbols,
  viewMode,
}: Props) {
  const [editForm, setEditForm] = useState({
    symbolCode: "",
    symbolName: "",
    qty: "",
    avgCost: "",
    accountType: "",
  });

  const handleAdd = () => {
    const qty = Number(editForm.qty);
    const avgCost = Number(editForm.avgCost);
    if (!editForm.symbolCode || isNaN(qty) || qty <= 0 || isNaN(avgCost) || avgCost <= 0) {
      alert("銘柄コード、数量（正数）、平均取得単価（正数）を入力してください");
      return;
    }
    const newPos: OpeningPosition = {
      id: generateId(),
      symbolCode: editForm.symbolCode,
      symbolName: editForm.symbolName || editForm.symbolCode,
      qty,
      avgCost,
      accountType: editForm.accountType,
    };
    onChange([...positions, newPos]);
    setEditForm({ symbolCode: "", symbolName: "", qty: "", avgCost: "", accountType: "" });
  };

  const handleDelete = (id: string) => {
    onChange(positions.filter((p) => p.id !== id));
  };

  const handleAddFromMissing = (m: typeof missingCostSymbols[0]) => {
    setEditForm({
      symbolCode: m.symbolCode,
      symbolName: m.symbolName,
      qty: String(m.shortQty),
      avgCost: "",
      accountType: m.accountType,
    });
  };

  return (
    <div className="space-y-4">
      {/* Missing cost symbols */}
      {missingCostSymbols.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-amber-800 mb-2">
            期首保有が必要な銘柄
          </h4>
          <p className="text-xs text-amber-700 mb-2">
            以下の銘柄は売却時にBUYロットが不足しています。取得単価を入力してください。
          </p>
          <div className="space-y-1">
            {missingCostSymbols.map((m) => (
              <div
                key={`${m.symbolCode}-${m.accountType}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-amber-800">
                  {m.symbolName} ({m.symbolCode}) - {m.shortQty}株
                  {m.accountType && ` [${m.accountType}]`}
                </span>
                <button
                  onClick={() => handleAddFromMissing(m)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  入力フォームに反映
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          期首ポジション追加
        </h4>
        <div className={`flex flex-wrap items-end ${viewMode === "mobile" ? "gap-2" : "gap-3"}`}>
          <div>
            <label className="block text-xs text-gray-500 mb-1">銘柄コード</label>
            <input
              type="text"
              value={editForm.symbolCode}
              onChange={(e) => setEditForm((f) => ({ ...f, symbolCode: e.target.value }))}
              className={`border border-gray-300 rounded px-2 py-1 text-sm ${viewMode === "mobile" ? "w-full" : "w-24"}`}
              placeholder="7203"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">銘柄名</label>
            <input
              type="text"
              value={editForm.symbolName}
              onChange={(e) => setEditForm((f) => ({ ...f, symbolName: e.target.value }))}
              className={`border border-gray-300 rounded px-2 py-1 text-sm ${viewMode === "mobile" ? "w-full" : "w-32"}`}
              placeholder="トヨタ自動車"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">数量</label>
            <input
              type="number"
              value={editForm.qty}
              onChange={(e) => setEditForm((f) => ({ ...f, qty: e.target.value }))}
              className={`border border-gray-300 rounded px-2 py-1 text-sm ${viewMode === "mobile" ? "w-full" : "w-24"}`}
              placeholder="100"
              min="1"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">平均取得単価</label>
            <input
              type="number"
              value={editForm.avgCost}
              onChange={(e) => setEditForm((f) => ({ ...f, avgCost: e.target.value }))}
              className={`border border-gray-300 rounded px-2 py-1 text-sm ${viewMode === "mobile" ? "w-full" : "w-28"}`}
              placeholder="2500"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">口座区分</label>
            <input
              type="text"
              value={editForm.accountType}
              onChange={(e) => setEditForm((f) => ({ ...f, accountType: e.target.value }))}
              className={`border border-gray-300 rounded px-2 py-1 text-sm ${viewMode === "mobile" ? "w-full" : "w-20"}`}
              placeholder="特定"
            />
          </div>
          <button
            onClick={handleAdd}
            className={`bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 transition-colors ${viewMode === "mobile" ? "w-full" : ""}`}
          >
            追加
          </button>
        </div>
      </div>

      {/* Position list */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          登録済みポジション
        </h4>
        {positions.length > 0 ? (
          <div className="overflow-x-auto">
            {viewMode === "mobile" && (
              <p className="text-xs text-gray-500 mb-2">横スクロールで全項目を確認できます。</p>
            )}
          <table className={`w-full ${viewMode === "mobile" ? "text-xs min-w-[720px]" : "text-sm"}`}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2">銘柄</th>
                <th className="text-left py-2 px-2">コード</th>
                <th className="text-right py-2 px-2">数量</th>
                <th className="text-right py-2 px-2">取得単価</th>
                <th className="text-left py-2 px-2">口座</th>
                <th className="text-right py-2 px-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-2">{p.symbolName}</td>
                  <td className="py-2 px-2 text-gray-500">{p.symbolCode}</td>
                  <td className="py-2 px-2 text-right">
                    {p.qty.toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {p.avgCost.toLocaleString()}円
                  </td>
                  <td className="py-2 px-2 text-gray-500">{p.accountType || "---"}</td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-600 hover:text-red-800 text-xs underline"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            期首ポジションが登録されていません
          </p>
        )}
      </div>
    </div>
  );
}
