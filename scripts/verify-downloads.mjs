import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { MASTER_DATA } from '../src/data/masterData.js';
import { DATA_MANIFEST } from '../src/data/dataManifest.js';
import { buildCompanyWorkbook, buildBenchmarkWorkbook } from '../src/utils/excelIO.js';

const readSheetRows = (workbook, sheetName) => {
  assert.ok(workbook.SheetNames.includes(sheetName), `${sheetName} 시트가 없습니다.`);
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
};

const selectedCompany = '풀무원';
const companyRows = MASTER_DATA.companies[selectedCompany];
const companyWorkbook = buildCompanyWorkbook(selectedCompany, companyRows, DATA_MANIFEST);
const companyRoundTrip = XLSX.read(XLSX.write(companyWorkbook, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
assert.equal(readSheetRows(companyRoundTrip, '전체 데이터').length, companyRows.length, '회사 데이터 행 수가 다릅니다.');
assert.ok(readSheetRows(companyRoundTrip, '다운로드 정보').length >= 6, '회사 다운로드 정보가 누락되었습니다.');
const companySheet = companyRoundTrip.Sheets['전체 데이터'];
const headerCells = XLSX.utils.sheet_to_json(companySheet, { header: 1 })[0];
for (const company of Object.keys(MASTER_DATA.companies)) {
  const rows = MASTER_DATA.companies[company];
  const wb = buildCompanyWorkbook(company, rows, DATA_MANIFEST);
  const roundTrip = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
  const sheet = roundTrip.Sheets['전체 데이터'];
  const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
  const getCell = (header, row = 2) => sheet[XLSX.utils.encode_cell({ r: row - 1, c: headers.indexOf(header) })];

  for (const header of ['연간 TSR', '순차입금(원)', 'Net Debt(B)', 'EV(원)', 'EBITDA(원)', 'EV/EBITDA', 'PER', 'PBR', 'ROE', '주가수익률(가격 기준)', 'DPS 기반 TSR 보정 효과', '순차입금/EBITDA (2026H1: TTM)']) {
    assert.ok(getCell(header)?.f, `${company} - ${header} 수식이 누락되었습니다.`);
  }
  const f2026 = (header) => getCell(header, rows.length)?.f || '';
  assert.ok(f2026('EV/EBITDA').includes('IF(LEFT('), `${company} - 2026H1 EV/EBITDA TTM 수식이 누락되었습니다.`);
  assert.ok(f2026('PER').includes('IF(LEFT('), `${company} - 2026H1 PER TTM 수식이 누락되었습니다.`);
}

// Pulmuone 2017 DPS and TSR formula explicit assertion
const pSheet = companyRoundTrip.Sheets['전체 데이터'];
const pHeaders = XLSX.utils.sheet_to_json(pSheet, { header: 1 })[0];
const p2017DpsCell = pSheet[XLSX.utils.encode_cell({ r: 2, c: pHeaders.indexOf('DPS') })]; // 2017 is row 3 (r=2)
assert.equal(Number(p2017DpsCell?.v), 115, `풀무원 2017 DPS가 115가 아닙니다: ${p2017DpsCell?.v}`);
const p2017TsrCell = pSheet[XLSX.utils.encode_cell({ r: 2, c: pHeaders.indexOf('연간 TSR') })];
assert.ok(p2017TsrCell?.f, '풀무원 2017 연간 TSR 수식이 누락되었습니다.');

const benchmarkWorkbook = buildBenchmarkWorkbook(MASTER_DATA.benchmarks, DATA_MANIFEST);
const benchmarkRoundTrip = XLSX.read(XLSX.write(benchmarkWorkbook, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
assert.equal(readSheetRows(benchmarkRoundTrip, 'KRX 비교지수').length, MASTER_DATA.benchmarks.krx.length, 'KRX 비교지수 행 수가 다릅니다.');
assert.equal(readSheetRows(benchmarkRoundTrip, '아파트 매매가격').length, MASTER_DATA.benchmarks.apartment.length, '아파트 매매가격 행 수가 다릅니다.');
assert.ok(readSheetRows(benchmarkRoundTrip, '다운로드 정보').length >= 6, '비교지수 다운로드 정보가 누락되었습니다.');

console.log(`다운로드 검증 통과: ${selectedCompany} ${companyRows.length}행, KRX ${MASTER_DATA.benchmarks.krx.length}행, 아파트 ${MASTER_DATA.benchmarks.apartment.length}행`);
