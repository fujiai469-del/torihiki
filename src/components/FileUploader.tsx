import { useCallback, useRef, useState } from "react";

type Props = {
  onFilesLoaded: (files: File[]) => void;
  onClear: () => void;
  hasData: boolean;
};

export function FileUploader({ onFilesLoaded, onClear, hasData }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const files = Array.from(fileList).filter(
        (f) => f.name.endsWith(".csv") || f.type === "text/csv" || f.type === "application/vnd.ms-excel"
      );
      if (files.length === 0) {
        alert("CSVファイルを選択してください");
        return;
      }
      onFilesLoaded(files);
    },
    [onFilesLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-claude-border p-6">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-claude-terra bg-claude-terra-light/30"
            : "border-claude-border hover:border-claude-terra/50"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="text-claude-text-secondary">
          <p className="text-lg font-medium text-claude-text">
            CSVファイルをドラッグ&ドロップ
          </p>
          <p className="text-sm mt-1">
            またはクリックしてファイルを選択（複数可）
          </p>
          <p className="text-xs mt-2 text-claude-text-secondary/70">
            SBI証券「約定履歴照会」CSV対応（Shift_JIS / UTF-8）
          </p>
        </div>
      </div>

      {hasData && (
        <div className="mt-3 text-right">
          <button
            onClick={onClear}
            className="text-sm text-red-600 hover:text-red-800 underline"
          >
            データをクリア
          </button>
        </div>
      )}
    </div>
  );
}
