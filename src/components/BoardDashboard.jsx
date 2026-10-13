import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import InfoTooltip from './InfoTooltip';
import { calculatePeriodReturns, formatKRW, formatMultiple, formatPercent, formatPercentagePoints,
  formatPeriodLabel, findPeriodRecord, peerMultipleSummary, getNetBorrowing, getNetDebtBroad,
  peerMedian, periodKey, safeNum } from '../utils/financialCalculators';

function marketReturn(rows) {
  const series = (rows || []).filter(row => row['지수명'] === 'KOSPI');
  const base = safeNum(findPeriodRecord(series, 2016)?.['기초값']);
  const close = safeNum(findPeriodRecord(series, 2025)?.['기말값']);
  return base > 0 && close !== null ? close / base - 1 : null;
}

export default function BoardDashboard({ records, allCompaniesData, benchmarkData, dataManifest,
  onOpenWorkingDashboard, onOpenBenchmarks, onOpenPeerComparison }) {
  const periods = useMemo(() => (records || []).map(row => periodKey(row['연도'])), [records]);
  const [selectedPeriod, setSelectedPeriod] = useState(() => periods.at(-1));
  const period = periods.includes(selectedPeriod) ? selectedPeriod : periods.at(-1);
  const current = findPeriodRecord(records, period);
  const prior = records[periods.indexOf(period) - 1];
  const official = calculatePeriodReturns(records || []);
  const peers = Object.entries(allCompaniesData || {}).filter(([name]) => name !== '풀무원')
    .map(([name, rows]) => ({ name, tsr: calculatePeriodReturns(rows).tsr10Y }));
  const peerFive = peerMedian(peers.map(peer => peer.tsr));
  const peerFour = peerMedian(peers.filter(peer => peer.name !== '삼양식품').map(peer => peer.tsr));
  const peerGap = official.tsr10Y !== null && peerFive !== null ? official.tsr10Y - peerFive : null;
  const multiplePeers = peerMultipleSummary(allCompaniesData, '풀무원', period);
  const multiple = safeNum(current?.['EV/EBITDA']);
  const multipleGap = multiple !== null && multiplePeers.evEbitda > 0 ? multiple / multiplePeers.evEbitda - 1 : null;
  const netDebt = getNetDebtBroad(current);
  const previousNetDebt = getNetDebtBroad(prior);
  const netDebtDelta = netDebt !== null && previousNetDebt !== null ? netDebt - previousNetDebt : null;
  const growth = safeNum(current?.['EBITDA 증감률 (2026H1: TTM vs FY2025)']);
  const tsr = safeNum(current?.['연간 TSR']);
  const half = period === '2026H1';
  const basis = half ? 'TTM' : '연간';
  const periodLabel = formatPeriodLabel(period, true);
  const relativeMultiple = multipleGap == null ? '비교 불가' : multipleGap === 0 ? '피어 중앙값과 동일' : `피어 중앙값 대비 ${formatPercent(Math.abs(multipleGap))} ${multipleGap < 0 ? '낮음' : '높음'}`;

  return <section className="board-v7 board-v8" aria-label="풀무원 이사회 요약 대시보드 v8">
    <section className="board-v7-section" aria-labelledby="official-performance-title">
      <div className="board-v7-section-heading"><div><h2 id="official-performance-title">10년 성과 진단</h2><span>FY2016 초 ~ FY2025 말</span></div>
        <InfoTooltip label="TSR 측정 기준" text="기업 피어: 세전·귀속 DPS·배당 비재투자 단순누적. 대표는 풀무원 제외 5사 중앙값, 삼양식품도 제외한 4사는 보조. 시장 비교: 풀무원 배당 재투자 TSR과 KOSPI TR." /></div>
      <div className="board-v7-kpis">
        <article className="board-v7-kpi emphasis"><span>풀무원 10년 TSR · 비재투자</span><strong className={official.tsr10Y >= 0 ? 'positive' : 'negative'}>{formatPercent(official.tsr10Y)}</strong><small>피어 중앙값 대비 {formatPercentagePoints(peerGap)}</small></article>
        <article className="board-v7-kpi"><span>피어 5사 중앙값 · 비재투자</span><strong>{formatPercent(peerFive)}</strong><small>4사 보조 중앙값 {formatPercent(peerFour)}</small></article>
        <article className="board-v7-kpi"><span>시장 비교 · 배당 재투자</span><div className="board-market-values"><b>풀무원 {formatPercent(official.reinvested?.tsr10Y)}</b><b>KOSPI TR {formatPercent(marketReturn(benchmarkData?.krx))}</b></div><small>기업 피어 비교와 측정 방식 구분</small></article>
      </div>
      <div className="board-v7-message"><p><b>상대성과:</b> {peerGap == null ? '비교 데이터 확인 필요' : `피어 중앙값 대비 ${formatPercentagePoints(peerGap)}. 단기 실적 개선이 장기 격차 해소로 이어지는지 점검.`}</p></div>
    </section>
    <section className="board-v7-section" aria-labelledby="latest-monitoring-title">
      <div className="board-v7-section-heading"><div><h3 id="latest-monitoring-title">결산 핵심 KPI</h3><span>{half ? '반기 성과 · 배수·레버리지 TTM' : '연간 성과 · 연간 이익 기준'}</span></div>
        <div className="board-period-control"><label htmlFor="board-period-select">기준 결산</label><select id="board-period-select" value={period} onChange={event => setSelectedPeriod(event.target.value)}>{periods.map(value => <option key={value} value={value}>{formatPeriodLabel(value, true)}</option>)}</select>
          <InfoTooltip label="선택 결산 KPI 산정 기준" text={`${periodLabel}: TSR은 단일 기간, 배수·레버리지는 ${basis} EBITDA 기준. 2026H1 TTM = FY2025 − 2025H1 + 2026H1. 순차입금과 Net Debt는 별도이며 EV = 시가총액 + Net Debt. 선택 결산은 공식 10년 성과를 변경하지 않습니다.`} /></div></div>
      <div className="board-v7-kpis">
        <article className="board-v7-kpi"><span>{half ? '반기' : '연간'} TSR</span><strong className={tsr >= 0 ? 'positive' : 'negative'}>{formatPercent(tsr)}</strong><small>{periodLabel} · 단일 기간</small></article>
        <article className="board-v7-kpi"><span>EV / EBITDA · {basis}</span><strong>{formatMultiple(multiple)}</strong><small>중앙값 {formatMultiple(multiplePeers.evEbitda)} · {relativeMultiple} ({multiplePeers.count}/{multiplePeers.total}사)</small></article>
        <article className="board-v7-kpi"><span>Net Debt</span><strong>{formatKRW(netDebt)}</strong><small>순차입금 {formatKRW(getNetBorrowing(current))} · 레버리지 {formatMultiple(safeNum(current?.['순차입금/EBITDA (2026H1: TTM)']))}</small></article>
      </div>
    </section>
    <section className="board-v7-section board-v7-decisions" aria-labelledby="board-agenda-title">
      <div className="board-v7-section-heading"><div><h3 id="board-agenda-title">경영진 점검 질문</h3><span>{periodLabel} 기준 · 관측 사실과 점검 질문</span></div></div>
      <div className="board-v7-agenda-grid">
        <article><b>이익 성장의 지속성</b><p>{basis} EBITDA 증감률 {formatPercent(growth)}</p><small>이익 개선이 반복 가능한 현금창출로 연결되는가?</small></article>
        <article><b>피어 대비 배수</b><p>{relativeMultiple}</p><small>성장성과 재무위험이 현재 배수를 뒷받침하는가?</small></article>
        <article><b>재무구조 변화</b><p>{netDebtDelta == null ? '직전 결산 비교 불가' : `Net Debt ${formatKRW(Math.abs(netDebtDelta))} ${netDebtDelta > 0 ? '증가' : netDebtDelta < 0 ? '감소' : '변동 없음'}`}</p><small>{prior ? `${formatPeriodLabel(prior['연도'], true)} 대비 · ` : ''}이익 성장과 부채 관리가 함께 진행되는가?</small></article>
      </div>
    </section>
    <footer className="board-v7-footer glass-card"><div><b>승인 기준 데이터 · v8.0</b><span>갱신 {dataManifest?.generatedAt ? new Date(dataManifest.generatedAt).toLocaleDateString('ko-KR') : '확인 필요'}</span><InfoTooltip label="기준 데이터 상세" text={`패키지 ${dataManifest?.dataVersion ?? '확인 필요'}. 이사회는 배포 기준 데이터만 사용합니다. 실무자용 개인 작업본·업로드 값은 미반영. 원천 엑셀 변경 시 추출·검증·배포가 필요합니다.`} /></div>
      <div className="board-v7-footer-actions"><button onClick={onOpenPeerComparison}>피어 상세 <ArrowRight size={15}/></button><button onClick={onOpenBenchmarks}>시장 상세 <ArrowRight size={15}/></button><button onClick={onOpenWorkingDashboard}>실무자용 <ArrowRight size={15}/></button></div></footer>
  </section>;
}
