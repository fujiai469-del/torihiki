import { describe, it, expect } from "vitest";
import { parseCSV } from "../parser";

describe("parseCSV", () => {
  it("ヘッダ行を自動検出してパースする", () => {
    const csv = `
説明行1
説明行2
約定日,銘柄,銘柄コード,市場,取引,期限,預り,課税,約定数量,約定単価,手数料/諸経費等,税額,受渡日,受渡金額/決済損益
2024/01/15,テスト銘柄,1234,東証,現物買,当日,特定,課税,100,1000,100,10,2024/01/17,100110
`.trim();

    const result = parseCSV(csv);
    expect(result.fills).toHaveLength(1);
    expect(result.successRows).toBe(1);
    expect(result.failedRows).toBe(0);

    const fill = result.fills[0];
    expect(fill.tradeDate).toBe("2024-01-15");
    expect(fill.symbolCode).toBe("1234");
    expect(fill.symbolName).toBe("テスト銘柄");
    expect(fill.side).toBe("BUY");
    expect(fill.qty).toBe(100);
    expect(fill.price).toBe(1000);
    expect(fill.fees).toBe(100);
    expect(fill.tax).toBe(10);
    expect(fill.accountType).toBe("特定");
  });

  it("手数料/税が'--'の場合はnull", () => {
    const csv = `約定日,銘柄,銘柄コード,市場,取引,期限,預り,課税,約定数量,約定単価,手数料/諸経費等,税額,受渡日,受渡金額/決済損益
2024/01/15,テスト銘柄,1234,東証,現物売,当日,特定,課税,100,1200,--,--,2024/01/17,120000`;

    const result = parseCSV(csv);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].fees).toBeNull();
    expect(result.fills[0].tax).toBeNull();
    expect(result.unknownFieldCount).toBe(2);
  });

  it("side判定: 買→BUY, 売→SELL", () => {
    const csv = `約定日,銘柄,銘柄コード,市場,取引,期限,預り,課税,約定数量,約定単価,手数料/諸経費等,税額,受渡日,受渡金額/決済損益
2024/01/15,銘柄A,1234,東証,現物買,当日,特定,課税,100,1000,0,0,2024/01/17,100000
2024/01/16,銘柄A,1234,東証,現物売,当日,特定,課税,100,1200,0,0,2024/01/18,120000`;

    const result = parseCSV(csv);
    expect(result.fills[0].side).toBe("BUY");
    expect(result.fills[1].side).toBe("SELL");
  });

  it("ヘッダ行が見つからない場合はエラー", () => {
    const csv = `これはCSVではないファイルです
ただのテキスト`;

    const result = parseCSV(csv);
    expect(result.fills).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("ヘッダ行が見つかりません");
  });

  it("ダブルクォートで囲まれた値を処理", () => {
    const csv = `約定日,銘柄,銘柄コード,市場,取引,期限,預り,課税,約定数量,約定単価,手数料/諸経費等,税額,受渡日,受渡金額/決済損益
"2024/01/15","テスト銘柄","1234","東証","現物買","当日","特定","課税","100","1,000","100","10","2024/01/17","100,110"`;

    const result = parseCSV(csv);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].price).toBe(1000);
    expect(result.fills[0].deliveryAmount).toBe(100110);
  });
});
