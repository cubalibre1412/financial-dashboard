import * as XLSX from 'xlsx';
import { recalculateRecord } from './financialCalculators.js';

/**
 * 기간 문자열을 정렬 가능한 가중치 숫자로 변환
 * 예: '2016' -> 2016.0, '2026 상반기' -> 2026.5, '2026 3분기' -> 2026.75
 */
export function parsePeriodOrder(periodStr) {
  const str = String(periodStr || '').trim();
  const match = str.match(/(\d{4})/);
  if (!match) return 9999;
  const year = parseInt(match[1], 10);
  
  if (str.includes('상반기') || str.includes('1H')) return year + 0.5;
  if (str.includes('하반기') || str.includes('2H')) return year + 0.99;
  if (str.includes('1분기') || str.includes('1Q')) return year + 0.25;
  if (str.includes('2분기') || str.includes('2Q')) return year + 0.50;
  if (str.includes('3분기') || str.includes('3Q')) return year + 0.75;
  if (str.includes('4분기') || str.includes('4Q')) return year + 0.99;
  return year; // 연간
}

const getDownloadDate = () => new Date().toISOString().slice(0, 10);

const setSheetLayout = (worksheet, rows) => {
  const headers = Object.keys(rows?.[0] || {});
  if (!headers.length) return;

  worksheet['!cols'] = headers.map((header) => ({
    wch: Math.min(36, Math.max(12, String(header).length + 4))
  }));
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } })
  };
};

/**
 * 원천 입력값은 값으로 유지하고 계산 열에는 Excel 수식을 부여한다.
 * 2026H1의 EV/EBITDA와 PER는 TTM 값을 분모로 참조한다.
 */
const applyCalculationFormulas = (worksheet, rows) => {
  const headers = Object.keys(rows?.[0] || {});
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const ref = (header, excelRow) => (
    column[header] === undefined ? null : `${XLSX.utils.encode_col(column[header])}${excelRow}`
  );
  const setFormula = (header, excelRow, formula) => {
    if (column[header] === undefined || !formula) return;
    const address = XLSX.utils.encode_cell({ r: excelRow - 1, c: column[header] });
    const existing = worksheet[address];
    const initialValue = (existing && typeof existing.v === 'number' && Number.isFinite(existing.v)) ? existing.v : 0;
    worksheet[address] = { ...existing, t: 'n', v: initialValue, f: formula };
  };
  const required = ['연도', '기초주가', '기말주가', 'DPS', '차입금(원)', '현금 및 현금성 자산(원)', '순차입금(원)', 'Net Debt(B)', 'EV(원)', 'EBIT(원)', 'EBITDA(원)', '시가총액(원)'];
  if (!required.every((header) => column[header] !== undefined)) return [];

  const applied = [];
  for (let index = 0; index < rows.length; index += 1) {
    const excelRow = index + 2;
    const year = ref('연도', excelRow);
    const begPrice = ref('기초주가', excelRow);
    const endPrice = ref('기말주가', excelRow);
    const dps = ref('DPS', excelRow);
    const openingShares = ref('기초 보유주식수', excelRow);
    const dividendReceived = ref('수령 배당금', excelRow);
    const reinvestPrice = ref('재투자 단가', excelRow);
    const addedShares = ref('추가 매수주식수', excelRow);
    const closingShares = ref('기말 보유주식수', excelRow);
    const priceValue = ref('주가평가액', excelRow);
    const annualTsr = ref('연간 TSR', excelRow);
    const marketCap = ref('시가총액(원)', excelRow);
    const cash = ref('현금 및 현금성 자산(원)', excelRow);
    const shortFin = ref('단기금융자산(원)', excelRow);
    const shortInv = ref('단기투자자산(원)', excelRow);
    const borrowings = ref('차입금(원)', excelRow);
    const netBorrowing = ref('순차입금(원)', excelRow);
    const lease = ref('리스부채(원)', excelRow);
    const hybrid = ref('신종자본증권(원)', excelRow);
    const nonControlling = ref('비지배지분(원)', excelRow);
    const netDebt = ref('Net Debt(B)', excelRow);
    const ev = ref('EV(원)', excelRow);
    const ebit = ref('EBIT(원)', excelRow);
    const depreciation = ref('감가상각비(원)', excelRow);
    const investmentDepreciation = ref('투자부동산감가상각비(원)', excelRow);
    const intangibleAmortization = ref('무형자산상각비(원)', excelRow);
    const ebitda = ref('EBITDA(원)', excelRow);
    const ttmEbitda = ref('2026H1 TTM EBITDA(원)', excelRow);
    const netIncome = ref('순이익(원)', excelRow);
    const ttmNetIncome = ref('2026H1 TTM 지배주주순이익(원)', excelRow);
    const equity = ref('자기자본(원)', excelRow);
    const averageEquity = ref('평균자기자본(원)', excelRow);
    const priceReturn = ref('주가수익률(가격 기준)', excelRow);
    const dividendEffect = ref('DPS 기반 TSR 보정 효과', excelRow);
    const ebitdaGrowth = ref('EBITDA 증감률 (2026H1: TTM vs FY2025)', excelRow);
    const effectiveEbitda = ttmEbitda ? `IF(LEFT(${year},4)="2026",${ttmEbitda},${ebitda})` : ebitda;
    const effectiveNetIncome = ttmNetIncome ? `IF(LEFT(${year},4)="2026",${ttmNetIncome},${netIncome})` : netIncome;

    if (dividendReceived && openingShares && dps) setFormula('수령 배당금', excelRow, `${openingShares}*${dps}`);
    if (reinvestPrice && endPrice) setFormula('재투자 단가', excelRow, endPrice);
    if (addedShares && dividendReceived && reinvestPrice) setFormula('추가 매수주식수', excelRow, `IFERROR(${dividendReceived}/${reinvestPrice},"")`);
    if (closingShares && openingShares && addedShares) setFormula('기말 보유주식수', excelRow, `${openingShares}+${addedShares}`);
    if (priceValue && closingShares && endPrice) setFormula('주가평가액', excelRow, `${closingShares}*${endPrice}`);
    if (annualTsr && begPrice && endPrice && dps) setFormula('연간 TSR', excelRow, `IFERROR((${endPrice}-${begPrice}+${dps})/${begPrice},"")`);
    setFormula('순차입금(원)', excelRow, `IF(OR(${borrowings}="",${cash}=""),"",${borrowings}-${cash}-${shortFin || 0}-${shortInv || 0})`);
    setFormula('Net Debt(B)', excelRow, `IF(${netBorrowing}="","",${netBorrowing}+${lease || 0}+${hybrid || 0}+${nonControlling || 0})`);
    setFormula('EV(원)', excelRow, `IF(OR(${marketCap}="",${netDebt}=""),"",${marketCap}+${netDebt})`);
    setFormula('EBITDA(원)', excelRow, `IF(${ebit}="","",${ebit}+${depreciation || 0}+${investmentDepreciation || 0}+${intangibleAmortization || 0})`);
    setFormula('EV/EBITDA', excelRow, `IFERROR(${ev}/(${effectiveEbitda}),"")`);
    setFormula('PER', excelRow, `IF((${effectiveNetIncome})<=0,"",${marketCap}/(${effectiveNetIncome}))`);
    if (equity) setFormula('PBR', excelRow, `IFERROR(${marketCap}/${equity},"")`);
    if (averageEquity) setFormula('ROE', excelRow, `IFERROR(${netIncome}/${averageEquity},"")`);
    if (priceReturn && begPrice && endPrice) setFormula('주가수익률(가격 기준)', excelRow, `IFERROR((${endPrice}-${begPrice})/${begPrice},"")`);
    if (dividendEffect && annualTsr && priceReturn) setFormula('DPS 기반 TSR 보정 효과', excelRow, `IFERROR(${annualTsr}-${priceReturn},"")`);
    setFormula('순차입금/EBITDA (2026H1: TTM)', excelRow, `IFERROR(${netBorrowing}/(${effectiveEbitda}),"")`);
    if (ebitdaGrowth) {
      if (index === 0) setFormula('EBITDA 증감률 (2026H1: TTM vs FY2025)', excelRow, '""');
      else {
        const priorEbitda = ref('EBITDA(원)', excelRow - 1);
        setFormula('EBITDA 증감률 (2026H1: TTM vs FY2025)', excelRow, `IFERROR((${effectiveEbitda}-${priorEbitda})/${priorEbitda},"")`);
      }
    }
    applied.push(excelRow);
  }
  return applied;
};

const appendDownloadInfo = (workbook, rows) => {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['항목', '내용'],
    ...rows
  ]);
  worksheet['!cols'] = [{ wch: 20 }, { wch: 76 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, '다운로드 정보');
};

/**
 * 선택 회사의 현재 브라우저 계산·보정값으로 워크북을 구성한다.
 * 테스트와 화면 다운로드가 동일한 생성 경로를 사용한다.
 */
export function buildCompanyWorkbook(companyName, records, metadata = {}) {
  if (!records?.length) throw new Error('다운로드할 회사 데이터가 없습니다.');

  const sorted = [...records].sort((a, b) => parsePeriodOrder(a['연도']) - parsePeriodOrder(b['연도']));
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(sorted);
  const formulaRows = applyCalculationFormulas(worksheet, sorted);
  setSheetLayout(worksheet, sorted);
  XLSX.utils.book_append_sheet(workbook, worksheet, '전체 데이터');
  appendDownloadInfo(workbook, [
    ['다운로드 구분', `${companyName} 회사별 데이터`],
    ['데이터 범위', '현재 브라우저에서 계산·보정된 전체 시계열'],
    ['수식 적용', formulaRows.length ? '계산 열은 Excel 수식, 원천 입력값은 값으로 제공' : '수식 적용 불가: 필수 열 누락'],
    ['TTM 유의사항', '2026H1 TTM EBITDA·TTM 지배주주순이익은 검증된 값으로 제공하며, EV/EBITDA·PER 수식에서 분모로 참조'],
    ['행 수', sorted.length],
    ['데이터 패키지', metadata.dataVersion || '확인 불가'],
    ['원천 갱신 시각', metadata.generatedAt || '확인 불가'],
    ['다운로드 시각', new Date().toLocaleString('ko-KR')]
  ]);
  return workbook;
}

/** Export selected company data to an .xlsx file. */
export function exportToExcel(companyName, records, metadata = {}) {
  const workbook = buildCompanyWorkbook(companyName, records, metadata);
  XLSX.writeFile(workbook, `${companyName}_대시보드_데이터_${getDownloadDate()}.xlsx`);
}

/**
 * 비교지수 원천 시계열을 KRX와 아파트 지수 시트로 분리한 워크북을 구성한다.
 */
export function buildBenchmarkWorkbook(benchmarkData, metadata = {}) {
  const krxRows = benchmarkData?.krx || [];
  const apartmentRows = benchmarkData?.apartment || [];
  if (!krxRows.length || !apartmentRows.length) {
    throw new Error('비교지수 데이터가 완전하지 않아 다운로드할 수 없습니다.');
  }

  const workbook = XLSX.utils.book_new();
  const krxSheet = XLSX.utils.json_to_sheet(krxRows);
  const apartmentSheet = XLSX.utils.json_to_sheet(apartmentRows);
  setSheetLayout(krxSheet, krxRows);
  setSheetLayout(apartmentSheet, apartmentRows);
  XLSX.utils.book_append_sheet(workbook, krxSheet, 'KRX 비교지수');
  XLSX.utils.book_append_sheet(workbook, apartmentSheet, '아파트 매매가격');
  appendDownloadInfo(workbook, [
    ['다운로드 구분', '비교지수 데이터'],
    ['KRX 비교지수 행 수', krxRows.length],
    ['아파트 매매가격 행 수', apartmentRows.length],
    ['데이터 패키지', metadata.dataVersion || '확인 불가'],
    ['원천 갱신 시각', metadata.generatedAt || '확인 불가'],
    ['다운로드 시각', new Date().toLocaleString('ko-KR')]
  ]);
  return workbook;
}

/** Export benchmark data to a separate .xlsx file. */
export function exportBenchmarkToExcel(benchmarkData, metadata = {}) {
  const workbook = buildBenchmarkWorkbook(benchmarkData, metadata);
  XLSX.writeFile(workbook, `비교지수_대시보드_데이터_${getDownloadDate()}.xlsx`);
}

/**
 * Full user data backup (JSON download)
 */
export function exportAllDataBackup(allData, version = "2.2.0") {
  const backupObj = {
    _backupMetadata: {
      exportedAt: new Date().toISOString(),
      version: version,
      type: "excelyze_full_backup"
    },
    companies: allData
  };

  const jsonStr = JSON.stringify(backupObj, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `excelyze_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse uploaded .xlsx or .csv file and extract '전체 데이터'
 * 동일한 정규화·의존성 재계산 규칙 적용 및 기간순 정렬
 */
export function parseUploadedFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      if (!workbook.SheetNames.includes("전체 데이터")) {
        callback(new Error("운영 편집용 업로드 파일에는 '전체 데이터' 시트가 필요합니다. 다른 시트를 임의로 사용하지 않았습니다."), null);
        return;
      }
      const sheetName = "전체 데이터";
      
      const worksheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!rawJson || rawJson.length === 0) {
        callback(new Error("엑셀 파일에 유효한 데이터 행이 없습니다."), null);
        return;
      }

      const required = ['연도', '기초주가', '기말주가', 'DPS', '시가총액(원)', '차입금(원)', '현금 및 현금성 자산(원)'];
      const missing = required.filter(key => !Object.prototype.hasOwnProperty.call(rawJson[0], key));
      if (missing.length) {
        callback(new Error(`필수 열 누락: ${missing.join(', ')}`), null);
        return;
      }

      // 1. 키 정규화 및 의존성 일괄 갱신
      const normalized = rawJson.map(row => {
        const cleaned = { ...row };
        // 시가총액 표준화
        if (cleaned['시가총액 (원)'] !== undefined && cleaned['시가총액(원)'] === undefined) {
          cleaned['시가총액(원)'] = cleaned['시가총액 (원)'];
        }
        // Net Debt 표준화
        if (cleaned['Net Debt'] !== undefined && cleaned['Net Debt(B)'] === undefined) {
          cleaned['Net Debt(B)'] = cleaned['Net Debt'];
        }
        return recalculateRecord(cleaned);
      });

      // 2. 중복 기간은 임의로 덮어쓰지 않고 중단
      const periodMap = new Map();
      normalized.forEach(r => {
        if (r['연도'] !== undefined && r['연도'] !== null && String(r['연도']).trim() !== '') {
          const key = String(r['연도']).trim();
          if (periodMap.has(key)) throw new Error(`중복 기간: ${key}`);
          periodMap.set(key, r);
        }
      });

      // 3. 실제 기간순으로 정렬
      const sortedRecords = Array.from(periodMap.values()).sort(
        (a, b) => parsePeriodOrder(a['연도']) - parsePeriodOrder(b['연도'])
      );

      callback(null, { sheetName, data: sortedRecords });
    } catch (err) {
      callback(err, null);
    }
  };
  reader.readAsArrayBuffer(file);
}
