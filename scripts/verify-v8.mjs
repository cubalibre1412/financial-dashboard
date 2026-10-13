import assert from 'node:assert/strict';
import { MASTER_DATA } from '../src/data/masterData.js';
import { recalculateRecord, peerMultipleSummary, periodKey, calculatePeriodReturns } from '../src/utils/financialCalculators.js';
let checked = 0;
for (const [name, records] of Object.entries(MASTER_DATA.companies)) {
  for (const record of records) {
    const result = recalculateRecord(record);
    const income = Number(record['순이익(원)']);
    const average = Number(record['평균자기자본(원)']);
    if (record['순이익(원)'] != null && average > 0) assert.ok(Math.abs(result.ROE-income/average)<1e-10, `${name} ${record['연도']} ROE`);
    checked++;
  }
  const latest = records.at(-1);
  const missingCash = recalculateRecord({...latest, '현금 및 현금성 자산(원)': null});
  for (const field of ['순차입금(원)','Net Debt(B)','EV(원)','순차입금/EBITDA (2026H1: TTM)']) assert.equal(missingCash[field], null, `${name} missing cash ${field}`);
  const missingPrice = recalculateRecord({...latest, '기초주가':null});
  assert.equal(missingPrice['연간 TSR'],null);
  assert.equal(missingPrice['DPS 기반 TSR 보정 효과'],null);
  assert.equal(recalculateRecord({...latest,DPS:null})['연간 TSR'],null);
}
const peer = peerMultipleSummary(MASTER_DATA.companies,'풀무원',2026);
assert.equal(peer.count,5);assert.ok(peer.evEbitda>4.9 && peer.evEbitda<4.91);
assert.equal(periodKey(2026),'2026H1');assert.equal(periodKey('2026FY'),'2026FY');
const original=calculatePeriodReturns(MASTER_DATA.companies['풀무원']).tsr10Y;
assert.ok(original < -.248 && original > -.249);
console.log(JSON.stringify({status:'PASS',records:checked,peerMedian:peer.evEbitda,official10Y:original}));
