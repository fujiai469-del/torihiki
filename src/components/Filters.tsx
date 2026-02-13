import type { FilterState } from "../lib/types";

type Props = {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  accountTypes: string[];
};

export function Filters({ filters, onChange, accountTypes }: Props) {
  const update = (partial: Partial<FilterState>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-3">フィルタ</h3>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">期間（開始）</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update({ dateFrom: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">期間（終了）</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update({ dateTo: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">口座区分</label>
          <select
            value={filters.accountType}
            onChange={(e) => update({ accountType: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">すべて</option>
            {accountTypes.map((at) => (
              <option key={at} value={at}>
                {at}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">銘柄検索</label>
          <input
            type="text"
            value={filters.symbolSearch}
            onChange={(e) => update({ symbolSearch: e.target.value })}
            placeholder="銘柄名 or コード"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="includeUncalculable"
            checked={filters.includeUncalculable}
            onChange={(e) => update({ includeUncalculable: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="includeUncalculable" className="text-sm text-gray-600">
            計算不可を含む
          </label>
        </div>
      </div>
    </div>
  );
}
