import React from 'react';
import { Activity, CalendarDays, Info } from 'lucide-react';
import KpiCards from './KpiCards';
import {
  formatKRW, formatPercent, getNetDebtBroad, safeNum, periodKey, formatPeriodLabel
} from '../utils/financialCalculators';

export default function LatestMonitoringSection({
  companyName,
  currentRecord,
  prevRecord,
  allRecords,
  peerAvg
}) {
  if (!currentRecord) return null;

  const is2026H1 = periodKey(currentRecord['연도']) === '2026H1';
  const periodLabel = formatPeriodLabel(currentRecord['연도'], true);
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
          <p>선택된 결산 기준 KPI</p>
        </div>
        <div className="latest-monitoring-badges" aria-label="최신 KPI 산정 기준">
          <span title={`${periodLabel}: 기초주가·기말주가·귀속 DPS를 적용한 단일 기간 TSR`}>
            <CalendarDays size={13} /> TSR · {is2026H1 ? '반기' : '연간'}
          </span>
          <span title={is2026H1 ? '2026.06.30 EV ÷ (FY2025 − 2025H1 + 2026H1) EBITDA' : `${periodLabel}: 결산 EV ÷ 연간 EBITDA`}>
            EBITDA·배수 · {is2026H1 ? 'TTM' : '연간'}
          </span>
          <span title={`${periodLabel}: 시가총액·순차입금·Net Debt·EV의 결산 기준`}>
            재무상태 · {periodLabel}
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
          {periodLabel} TSR {formatPercent(currentTsr)}, {is2026H1 ? 'TTM' : '연간'} EBITDA 증감률 {formatPercent(ebitdaGrowth)},
          {' '}Net Debt는 {prevRecord ? formatPeriodLabel(prevRecord['연도'], true) : '직전 결산'} 대비 {netDebtDelta == null ? '확인 불가' : `${formatKRW(Math.abs(netDebtDelta))} ${netDebtDirection}`}입니다.
          {' '}이익체력·재무구조·주주가치 신호를 함께 점검해야 합니다.
        </span>
      </div>
    </section>
  );
}
