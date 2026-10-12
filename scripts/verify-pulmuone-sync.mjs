import XLSX from 'xlsx';
import { MASTER_DATA } from '../src/data/masterData.js';

const wb = XLSX.readFile('../풀무원_TSR_Valuation_2016_2026.xlsx');
const ws = wb.Sheets['전체 데이터'];
const excelRows = XLSX.utils.sheet_to_json(ws);
const masterRows = MASTER_DATA.companies['풀무원'];

let diffCount = 0;
const checkFields = [
  '연도', '기초주가', '기말주가', 'DPS',
  '기초 보유주식수', '수령 배당금', '재투자 단가',
  '추가 매수주식수', '기말 보유주식수', '주가평가액',
  '최종가치(배당재투자)', '연간 TSR'
];

for (let i = 0; i < excelRows.length; i++) {
  const er = excelRows[i];
  const mr = masterRows[i];
  for (const f of checkFields) {
    const ev = er[f];
    const mv = mr[f];
    if (typeof ev === 'number' && typeof mv === 'number') {
      if (Math.abs(ev - mv) > 1e-5) {
        console.log(`[Diff] Row ${i} (${er['연도']}) ${f}: Excel=${ev}, Master=${mv}`);
        diffCount++;
      }
    } else if (ev !== mv) {
      console.log(`[Diff] Row ${i} (${er['연도']}) ${f}: Excel=${ev}, Master=${mv}`);
      diffCount++;
    }
  }
}

console.log(`PULMUONE SYNC RESULT: ${diffCount} differences found across ${excelRows.length} rows.`);
if (diffCount === 0) {
  console.log('✅ 풀무원 2016~2026년 엑셀↔대시보드 연동값 불일치 0건 확인 완료');
} else {
  process.exit(1);
}
