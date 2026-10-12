import React from 'react';
import { Activity, CalendarDays, Info } from 'lucide-react';
import KpiCards from './KpiCards';
import {
  formatKRW, formatPercent, getNetDebtBroad, safeNum
} from '../utils/financialCalculators';

export default function LatestMonitoringSection({
  companyName,
  currentRecord,
  prevRecord,
  allRecords,
  peerAvg
}) {
  if (!currentRecord) return null;

  const is2026H1 = String(currentRecord['연도'] || '').includes('2026');
  const periodLabel = is2026H1 ? 'FY2026 1H' : String(currentRecord['연도'] || '최신 결산');
  const currentTsr = safeNum(currentRecord['연간 TSR']);
  const ebitdaGrowth = safeNum(currentRecord['EBITDA 증감률 (2026H1: TTM vs FY2025)']);
  const currentNetDebt = getNetDebtBroad(currentRecord);
  const priorNetDebt = getNetDebtBroad(prevRecord);
  const netDebtDelta = currentNetDebt != null && priorNetDebt != null
    ? currentNetDebt - priorNetDebt
    : null;
  const netDebtDirection = netDebtDelta == null ? '' : netDebtDelta > 0 ? '증가' : netDebtDelta < 0 ? '감소' : '변동 없음';

  return (
    <section className="latest-monitoring-section" aria-labelledby="latest-monitoring-title">
      <header className="latest-monitoring-header">
        <div className="latest-monitoring-heading">
          <span className="latest-monitoring-kicker"><Activity size={14} /> 최신 모니터링</span>
          <h2 id="latest-monitoring-title">{periodLabel} KPI</h2>
          <p>공식 10년 성과평가와 분리된 최신 결산 모니터링입니다.</p>
        </div>
        <div className="latest-monitoring-badges" aria-label="최신 KPI 산정 기준">
          <span title="TSR: 2025.12.31 기말주가에서 2026.06.30 기말주가까지의 상반기 단일 기간">
            <CalendarDays size={13} /> TSR · 반기
          </span>
          <span title="EV/EBITDA: 2026.06.30 시점 EV를 FY2025 - 2025H1 + 2026H1의 최근 12개월 EBITDA로 나눈 값">
            EBITDA·배수 · TTM
          </span>
          <span title="시가총액·순차입금·Net Debt·EV: 2026.06.30 재무상태표 및 시장가치 기준">
            재무상태 · 2026.06.30
          </span>
          <Info size={15} className="latest-monitoring-info" aria-label="각 배지에 마우스를 올리면 산정 기준을 확인할 수 있습니다." />
        </div>
      </header>

      <KpiCards
        companyName={companyName}
        currentRecord={currentRecord}
        prevRecord={prevRecord}
        allRecords={allRecords}
        peerAvg={peerAvg}
      />

      <div className="latest-monitoring-signal">
        <strong>최신 신호</strong>
        <span>
          {periodLabel} TSR {formatPercent(currentTsr)}, TTM EBITDA 증감률 {formatPercent(ebitdaGrowth)},
          {' '}Net Debt는 직전 연말 대비 {netDebtDelta == null ? '확인 불가' : `${formatKRW(Math.abs(netDebtDelta))} ${netDebtDirection}`}입니다.
          {' '}이익체력·재무구조·주주가치 신호를 함께 점검해야 합니다.
        </span>
      </div>
    </section>
  );
}
