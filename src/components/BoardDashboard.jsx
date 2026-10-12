import React, { useMemo } from 'react';
import { ArrowRight, BarChart3, ChartNoAxesCombined, Landmark, ShieldCheck } from 'lucide-react';
import {
  calculatePeriodReturns, formatKRW, formatMultiple, formatPercent,
  getNetBorrowing, getNetDebtBroad, peerMedian, safeNum
} from '../utils/financialCalculators';

const rowForYear = (rows, year) => (rows || []).find(row => String(row['연도']).startsWith(String(year)));

function benchmarkReturn(rows, indexName) {
  const indexRows = (rows || []).filter(row => row['지수명'] === indexName);
  const start = rowForYear(indexRows, 2016);
  const end = rowForYear(indexRows, 2025);
  const base = safeNum(start?.['기초값']);
  const close = safeNum(end?.['기말값']);
  return base && close != null ? close / base - 1 : null;
}

export default function BoardDashboard({ records, allCompaniesData, benchmarkData, onOpenWorkingDashboard, onOpenBenchmarks, onOpenPeerComparison }) {
  const m = useMemo(() => {
    const h1 = rowForYear(records, 2026);
    const official = calculatePeriodReturns(records || []);
    const peers = Object.entries(allCompaniesData || {})
      .filter(([name]) => name !== '풀무원')
      .map(([name, rows]) => ({
        name,
        tsr: calculatePeriodReturns(rows).tsr10Y,
        evEbitda: safeNum(rowForYear(rows, 2026)?.['EV/EBITDA'])
      }));
    const peerFive = peerMedian(peers.map(peer => peer.tsr));
    const peerFour = peerMedian(peers.filter(peer => peer.name !== '삼양식품').map(peer => peer.tsr));
    const peerMultiple = peerMedian(peers.map(peer => peer.evEbitda).filter(value => value != null && value > 0));
    return {
      officialTsr: official.tsr10Y,
      peerFive,
      peerFour,
      marketTsr: benchmarkReturn(benchmarkData?.krx, 'KOSPI'),
      h1Tsr: safeNum(h1?.['연간 TSR']),
      h1Multiple: safeNum(h1?.['EV/EBITDA']),
      peerMultiple,
      netDebt: getNetDebtBroad(h1),
      netBorrowing: getNetBorrowing(h1),
      leverage: safeNum(h1?.['순차입금/EBITDA (2026H1: TTM)'])
    };
  }, [records, allCompaniesData, benchmarkData]);

  const peerGap = m.officialTsr != null && m.peerFive != null ? m.officialTsr - m.peerFive : null;
  const multipleGap = m.h1Multiple != null && m.peerMultiple != null ? m.h1Multiple / m.peerMultiple - 1 : null;

  return (
    <section className="board-v7" aria-label="풀무원 이사회 요약 대시보드">
      <header className="board-v7-hero glass-card">
        <div>
          <span className="board-v7-eyebrow">PULMUONE · BOARD VIEW</span>
          <h2>이사회 핵심 성과 요약</h2>
          <p>공식 성과와 최신 현황을 분리 표시합니다.</p>
        </div>
        <div className="board-v7-periods" aria-label="기준 기간">
          <span><b>공식 성과</b> FY2016~FY2025</span>
          <span><b>최신 모니터링</b> FY2026H1</span>
        </div>
      </header>

      <section className="board-v7-section" aria-labelledby="official-performance-title">
        <div className="board-v7-section-heading">
          <div><span>01 · 공식 장기 성과</span><h3 id="official-performance-title">10년 성과 진단</h3></div>
          <span className="board-v7-basis-chip" title="피어 비교는 귀속 DPS 기준의 배당 비재투자 단순누적, 시장 비교는 KOSPI 총수익지수(TR) 기준입니다.">측정 기준 ⓘ</span>
        </div>
        <div className="board-v7-kpis">
          <article className="board-v7-kpi emphasis"><span>풀무원 10년 TSR</span><strong className={m.officialTsr >= 0 ? 'positive' : 'negative'}>{formatPercent(m.officialTsr)}</strong><small>FY2016 초 ~ FY2025 말 · 비재투자</small></article>
          <article className="board-v7-kpi"><span>피어 5사 중앙값</span><strong>{formatPercent(m.peerFive)}</strong><small>격차 {peerGap == null ? '—' : formatPercent(peerGap)} · 4사 참고 {formatPercent(m.peerFour)}</small></article>
          <article className="board-v7-kpi"><span>시장 기준</span><strong className={m.marketTsr >= 0 ? 'positive' : 'negative'}>{formatPercent(m.marketTsr)}</strong><small>KOSPI TR · 배당 재투자 참고지표</small></article>
        </div>
        <div className="board-v7-message"><ChartNoAxesCombined size={18}/><p><b>핵심 진단:</b> 피어 5사 중앙값 대비 {peerGap == null ? '확인 필요' : formatPercent(peerGap)}. EBITDA 개선과 Net Debt 관리가 핵심입니다.</p></div>
      </section>

      <section className="board-v7-section" aria-labelledby="latest-monitoring-title">
        <div className="board-v7-section-heading">
          <div><span>02 · 최신 모니터링</span><h3 id="latest-monitoring-title">FY2026H1 핵심 KPI</h3></div>
          <span className="board-v7-basis-chip" title="TSR은 반기 단일 기간, EV/EBITDA·레버리지는 TTM, 재무상태표는 2026.06.30 기준입니다.">산정 기준 ⓘ</span>
        </div>
        <div className="board-v7-kpis">
          <article className="board-v7-kpi"><span>2026H1 TSR</span><strong className={m.h1Tsr >= 0 ? 'positive' : 'negative'}>{formatPercent(m.h1Tsr)}</strong><small>반기 단일 기간</small></article>
          <article className="board-v7-kpi"><span>EV / EBITDA</span><strong>{formatMultiple(m.h1Multiple)}</strong><small>피어 중앙 {formatMultiple(m.peerMultiple)} · {multipleGap == null ? '비교 불가' : formatPercent(multipleGap)}</small></article>
          <article className="board-v7-kpi"><span>Net Debt</span><strong>{formatKRW(m.netDebt)}</strong><small>순차입금 {formatKRW(m.netBorrowing)} · 레버리지 {formatMultiple(m.leverage)}</small></article>
        </div>
      </section>

      <section className="board-v7-section board-v7-decisions" aria-labelledby="board-agenda-title">
        <div className="board-v7-section-heading">
          <div><span>03 · 이사회 점검사항</span><h3 id="board-agenda-title">의사결정에 필요한 질문</h3></div>
          <span className="board-v7-basis-chip">경영진 답변 필요</span>
        </div>
        <div className="board-v7-agenda-grid">
          <article><BarChart3 size={19}/><b>장기 TSR 회복 경로</b><p>EBITDA·현금창출·주주환원 중 핵심 관리지표를 점검합니다.</p></article>
          <article><Landmark size={19}/><b>밸류에이션 재평가 조건</b><p>TTM EBITDA의 지속성과 피어 대비 배수를 점검합니다.</p></article>
          <article><ShieldCheck size={19}/><b>재무구조 관리 방향</b><p>순차입금·Net Debt와 현금창출력의 연결을 점검합니다.</p></article>
        </div>
      </section>

      <footer className="board-v7-footer glass-card">
        <div><b>상세 분석 및 원천 데이터는 실무자용에서 확인</b></div>
        <div className="board-v7-footer-actions">
          <button onClick={onOpenPeerComparison}>피어 비교 상세 <ArrowRight size={15}/></button>
          <button onClick={onOpenBenchmarks}>시장 비교 상세 <ArrowRight size={15}/></button>
          <button className="primary" onClick={onOpenWorkingDashboard}>실무자용 대시보드 <ArrowRight size={15}/></button>
        </div>
      </footer>
    </section>
  );
}
