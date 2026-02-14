import type { ParseResult } from "../lib/types";

type Props = {
  results: ParseResult[];
};

export function ParseSummary({ results }: Props) {
  const totalRows = results.reduce((s, r) => s + r.totalRows, 0);
  const successRows = results.reduce((s, r) => s + r.successRows, 0);
  const failedRows = results.reduce((s, r) => s + r.failedRows, 0);
  const unknownFieldCount = results.reduce((s, r) => s + r.unknownFieldCount, 0);
  const allErrors = results.flatMap((r) => r.errors);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-claude-border p-4">
      <h3 className="font-semibold text-claude-text mb-2">解析結果</h3>
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-claude-text-secondary">取込行数:</span>{" "}
          <span className="font-medium text-claude-text">{totalRows}</span>
        </div>
        <div>
          <span className="text-claude-text-secondary">成功:</span>{" "}
          <span className="font-medium text-green-600">{successRows}</span>
        </div>
        {failedRows > 0 && (
          <div>
            <span className="text-claude-text-secondary">失敗:</span>{" "}
            <span className="font-medium text-red-600">{failedRows}</span>
          </div>
        )}
        {unknownFieldCount > 0 && (
          <div>
            <span className="text-claude-text-secondary">不明項目:</span>{" "}
            <span className="font-medium text-claude-terra">
              {unknownFieldCount}
            </span>
          </div>
        )}
      </div>

      {allErrors.length > 0 && (
        <details className="mt-3">
          <summary className="text-sm text-red-600 cursor-pointer">
            エラー詳細 ({allErrors.length}件)
          </summary>
          <ul className="mt-1 text-xs text-red-600 space-y-0.5 max-h-40 overflow-y-auto">
            {allErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
