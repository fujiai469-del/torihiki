import type { NormalizedFill, ParseResult } from "./types";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function isHeaderRow(fields: string[]): boolean {
  const required = ["約定日", "銘柄コード", "約定数量", "約定単価"];
  return required.every((h) => fields.includes(h));
}

function parseJapaneseDate(dateStr: string): string | null {
  // Handle formats like "2024/01/15" or "24/01/15" or "2024-01-15" or "24.01.15"
  const cleaned = dateStr.replace(/[年月]/g, "/").replace(/日/, "").trim();
  const match = cleaned.match(/^(\d{2,4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!match) return null;

  let year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 100) {
    year += 2000;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseNumber(value: string): number | null {
  if (!value || value === "--" || value === "―" || value === "-") return null;
  const cleaned = value.replace(/,/g, "").replace(/円/g, "").trim();
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function determineSide(tradeStr: string): "BUY" | "SELL" | "OTHER" {
  if (tradeStr.includes("買")) return "BUY";
  if (tradeStr.includes("売")) return "SELL";
  return "OTHER";
}

export function decodeShiftJIS(buffer: ArrayBuffer): string {
  // Try Shift_JIS first, fallback to UTF-8
  try {
    const decoder = new TextDecoder("shift_jis");
    const text = decoder.decode(buffer);
    // Heuristic: if it decodes with lots of replacement characters, try UTF-8
    if (text.includes("\uFFFD")) {
      const utf8Decoder = new TextDecoder("utf-8");
      const utf8Text = utf8Decoder.decode(buffer);
      if (!utf8Text.includes("\uFFFD") || utf8Text.split("\uFFFD").length < text.split("\uFFFD").length) {
        return utf8Text;
      }
    }
    return text;
  } catch {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  }
}

export function parseCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const errors: string[] = [];
  let fills: NormalizedFill[] = [];
  let headerIndex = -1;
  let headers: string[] = [];

  // Find header row
  for (let i = 0; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (isHeaderRow(fields)) {
      headerIndex = i;
      headers = fields;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      fills: [],
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      unknownFieldCount: 0,
      errors: ["ヘッダ行が見つかりません。「約定日」「銘柄コード」「約定数量」「約定単価」を含む行が必要です。"],
    };
  }

  let totalRows = 0;
  let successRows = 0;
  let failedRows = 0;
  let unknownFieldCount = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    totalRows++;
    const fields = parseCSVLine(line);

    if (fields.length < headers.length) {
      errors.push(`行 ${i + 1}: 列数不足 (${fields.length}/${headers.length})`);
      failedRows++;
      continue;
    }

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = fields[idx] ?? "";
    });

    const tradeDate = parseJapaneseDate(raw["約定日"] ?? "");
    if (!tradeDate) {
      errors.push(`行 ${i + 1}: 約定日を解析できません: "${raw["約定日"]}"`);
      failedRows++;
      continue;
    }

    const symbolName = raw["銘柄"] ?? "";
    const symbolCode = raw["銘柄コード"] ?? "";

    if (!symbolCode) {
      errors.push(`行 ${i + 1}: 銘柄コードが空です`);
      failedRows++;
      continue;
    }

    const qty = parseNumber(raw["約定数量"] ?? "");
    if (qty === null || qty <= 0) {
      errors.push(`行 ${i + 1}: 約定数量が不正: "${raw["約定数量"]}"`);
      failedRows++;
      continue;
    }

    const price = parseNumber(raw["約定単価"] ?? "");
    if (price === null || price < 0) {
      errors.push(`行 ${i + 1}: 約定単価が不正: "${raw["約定単価"]}"`);
      failedRows++;
      continue;
    }

    const fees = parseNumber(raw["手数料/諸経費等"] ?? "");
    const tax = parseNumber(raw["税額"] ?? "");
    const deliveryAmount = parseNumber(raw["受渡金額/決済損益"] ?? "");
    const deliveryDate = parseJapaneseDate(raw["受渡日"] ?? "") ?? undefined;

    if (fees === null) unknownFieldCount++;
    if (tax === null) unknownFieldCount++;

    const fill: NormalizedFill = {
      tradeDate,
      symbolName,
      symbolCode,
      market: raw["市場"] ?? undefined,
      side: determineSide(raw["取引"] ?? ""),
      qty,
      price,
      fees,
      tax,
      accountType: raw["預り"] ?? undefined,
      deliveryDate,
      deliveryAmount,
      raw,
    };

    fills.push(fill);
    successRows++;
  }

  // Sort by tradeDate ascending
  fills.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));

  return {
    fills,
    totalRows,
    successRows,
    failedRows,
    unknownFieldCount,
    errors,
  };
}
