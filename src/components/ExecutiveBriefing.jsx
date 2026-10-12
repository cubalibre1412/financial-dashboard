import React, { useState } from 'react';
import { 
  Sparkles, Award, Compass, ShieldCheck, 
  BarChart3, Activity, Info, ArrowRight 
} from 'lucide-react';
import { 
  formatPercent, formatKRW, formatMultiple, formatPeriodLabel, 
  calculatePeriodReturns, getMarketCap, getNetDebtBroad, getNetBorrowing,
  decomposeMarketCapChange, safeNum, periodKey, formatPercentagePoints 
} from '../utils/financialCalculators';
import TsrScenario from './TsrScenario';
import TsrDecompositionCard from './TsrDecompositionCard';
import MarketCapWaterfall from './MarketCapWaterfall';
import CapitalStructureWaterfall from './CapitalStructureWaterfall';
import ManagementTrendsChart from './ManagementTrendsChart';
import BoardReportView from './BoardReportView';

export default function ExecutiveBriefing({ 
  companyName, 
  records, 
  allCompaniesData, 
  benchmarkData,
  onOpenBenchmarks,
  theme 
}) {
  // 기본값: 'SUMMARY' (경영진 요약 화면) - Hook을 조건문 전에 무조건 호출
  const isPulmuone = companyName === '풀무원';
  const [activeTab, setActiveTab] = useState(isPulmuone ? 'BOARD' : 'SUMMARY');

  if (!records || records.length === 0) return null;

  const latest = records[records.length - 1];
  const peerLabel = `${companyName} 제외 5사`;
  const prev = records.length > 1 ? records[records.length - 2] : null;
  const selectedPeriod = latest['연도'];

  // 10Y TSR: 2016년 초 ~ 2025년 말 통일 기준
  const periodReturns = calculatePeriodReturns(records);
  const cumTSR = periodReturns.tsr10Y;

  const currentMcap = getMarketCap(latest);
  const netDebt = getNetDebtBroad(latest);
  const netBorrowing = getNetBorrowing(latest);
  const evVal = safeNum(latest['EV(원)']);
  const evEbitda = safeNum(latest['EV/EBITDA']);

  // 피어 통계 (6개사 전체 평균 및 중위값)
  const peerList = Object.keys(allCompaniesData || {}).filter(n => n !== companyName);
  const peerMetrics = peerList.map(pName => {
    const pRecs = allCompaniesData[pName] || [];
    const pLatest = pRecs.find(r => periodKey(r['연도']) === periodKey(selectedPeriod)) || {};
    const pr = calculatePeriodReturns(pRecs);
    return {
      name: pName,
      cumTSR: pr.tsr10Y,
      evEbitda: safeNum(pLatest['EV/EBITDA']),
      mcap: getMarketCap(pLatest),
      roe: safeNum(pLatest['ROE'])
    };
  });

  const validCumTSRs = peerMetrics.map(m => m.cumTSR).filter(v => v !== null && !isNaN(v));
  const validEvEbitdas = peerMetrics.map(m => m.evEbitda).filter(v => v !== null && !isNaN(v) && v > 0);

  const getMedian = (arr) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  const peerMedianCumTSR = getMedian(validCumTSRs);
  const peerMedianEvEbitda = getMedian(validEvEbitdas);

  // KOSPI TR 비교 (2016~2025)
  let kospi10Y = null;
  if (benchmarkData?.krx) {
    const kospi = benchmarkData.krx.filter(r => r['지수명'] === 'KOSPI');
    const r2016 = kospi.find(r => String(r['연도']).startsWith('2016'));
    const r2025 = kospi.find(r => String(r['연도']).startsWith('2025'));
    if (r2016 && r2025) {
      const b0 = Number(r2016['기초값']) || 1;
      const bEnd = Number(r2025['기말값']) || b0;
      kospi10Y = (bEnd - b0) / b0;
    }
  }

  // 중단 핵심 시각화 1: 최신 연도 TSR 구성 (주가수익률 + DPS 보정 효과)
  const latestPriceReturn = safeNum(latest['주가수익률(가격 기준)']);
  const latestDpsEffect = safeNum(latest['DPS 기반 TSR 보정 효과']);
  const latestAnnualTsr = safeNum(latest['연간 TSR']);

  // 중단 핵심 시각화 2: 시가총액 변동 3요인 분해 (직전 연도 -> 최신 결산)
  const decompTargetStart = records.find(r => String(r['연도']).startsWith('2025')) || prev;
  const decomp = (decompTargetStart && latest && decompTargetStart !== latest)
    ? decomposeMarketCapChange(decompTargetStart, latest)
    : null;

  // 순차입금/EBITDA
  const netBorrowingEbitda = safeNum(latest['순차입금/EBITDA (2026H1: TTM)']);

  return (
    <div className="briefing-container">
      {/* 1. 상단 경영진 총괄 헤더 및 탭 네비게이션 */}
      <div className="briefing-card glass-card mb-3">
        <div className="briefing-header">
          <div className="briefing-title-group">
            <div className="briefing-icon-wrapper">
              <Sparkles className="color-pos" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="briefing-title">경영진 핵심 인텔리전스 브리핑 ({companyName})</h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  v6.0
                </span>
              </div>
              <span className="briefing-date">
                데이터 기준: 10개년 누적(2016~2025년) 및 최신 {formatPeriodLabel(latest['연도'], true)} 결산 · 단일 원천 엑셀 기준
              </span>
            </div>
          </div>

          {/* 탭 네비게이션 (고유 data-testid 부여) */}
          <div className="briefing-tab-group">
            {isPulmuone && <button data-testid="briefing-tab-board" onClick={() => setActiveTab('BOARD')} className={`briefing-tab-btn ${activeTab === 'BOARD' ? 'active' : ''}`}>이사회 보고</button>}
            <button
              data-testid="briefing-tab-summary"
              onClick={() => setActiveTab('SUMMARY')}
              className={`briefing-tab-btn ${activeTab === 'SUMMARY' ? 'active' : ''}`}
            >
              경영진 요약 (기본)
            </button>
            <button
              data-testid="briefing-tab-a"
              onClick={() => setActiveTab('A')}
              className={`briefing-tab-btn ${activeTab === 'A' ? 'active' : ''}`}
            >
              A. TSR 구성 상세
            </button>
            <button
              data-testid="briefing-tab-b"
              onClick={() => setActiveTab('B')}
              className={`briefing-tab-btn ${activeTab === 'B' ? 'active' : ''}`}
            >
              B. 시가총액 변동 분해 상세
            </button>
            <button
              data-testid="briefing-tab-c"
              onClick={() => setActiveTab('C')}
              className={`briefing-tab-btn ${activeTab === 'C' ? 'active' : ''}`}
            >
              C. 자본구조·EV 연결 상세
            </button>
            <button
              data-testid="briefing-tab-d"
              onClick={() => setActiveTab('D')}
              className={`briefing-tab-btn ${activeTab === 'D' ? 'active' : ''}`}
            >
              D. 관리지표 추이·피어 위치
            </button>
            {isPulmuone && <button data-testid="briefing-tab-sim" onClick={() => setActiveTab('SIM')} className={`briefing-tab-btn ${activeTab === 'SIM' ? 'active' : ''}`}>E. 풀무원 연말 TSR 시뮬레이션</button>}
          </div>
        </div>

        {isPulmuone && activeTab === 'BOARD' && <BoardReportView records={records} allCompaniesData={allCompaniesData} benchmarkData={benchmarkData} onNavigate={setActiveTab} onOpenBenchmarks={onOpenBenchmarks} />}
        {isPulmuone && activeTab === 'SIM' && <TsrScenario records={allCompaniesData?.['풀무원'] || []} />}
        {/* 2. 기본 화면: 경영진 요약 (SUMMARY) */}
        {activeTab === 'SUMMARY' && (
          <div className="briefing-summary-container">
            {/* 상단: 핵심 결론 3개 카드 */}
            <div className="briefing-top-cards">
              {/* Card 1: 10년 누적 TSR 및 피어/KOSPI TR 대비 */}
              <div className="briefing-top-card">
                <div>
                  <div className="card-top-row">
                    <div className="card-top-title">
                      <Award size={16} className="accent-blue" />
                      <span>10개년 TSR · 비재투자</span>
                    </div>
                    <span className="text-[11px] text-muted">'16초 ~ '25말</span>
                  </div>
                  <div className="card-main-metric">
                    <span className={`card-metric-val tabular-nums ${cumTSR !== null && cumTSR >= 0 ? 'color-pos' : 'color-neg'}`}>
                      {cumTSR !== null ? formatPercent(cumTSR) : '데이터 없음'}
                    </span>
                    <span className="text-xs text-muted">({companyName})</span>
                  </div>
                </div>
                <div className="card-sub-info">
                  <div className="card-info-row"><span>재투자 TSR (보조):</span><span>{formatPercent(periodReturns.reinvested?.tsr10Y)}</span></div>
                  {isPulmuone && <div className="card-info-row"><span>4사 중앙값 (풀무원·삼양 제외):</span><span>{formatPercent(getMedian(peerMetrics.filter(p=>p.name!=='삼양식품').map(p=>p.cumTSR).filter(v=>v!==null)))}</span></div>}
                  <div className="card-info-row">
                    <span>{peerLabel} 중앙값:</span>
                    <span className="card-info-val tabular-nums">{formatPercent(peerMedianCumTSR)}</span>
                  </div>
                  <div className="card-info-row">
                    <span>KOSPI TR (재투자·참고):</span>
                    <span className="card-info-val tabular-nums text-sky-400">
                      {kospi10Y !== null ? formatPercent(kospi10Y) : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: 최신 EV/EBITDA 및 피어 중앙값 */}
              <div className="briefing-top-card">
                <div>
                  <div className="card-top-row">
                    <div className="card-top-title">
                      <Compass size={16} className="accent-purple" />
                      <span>최신 EV/EBITDA 배수 현황</span>
                    </div>
                    <span className="text-[11px] text-muted">2026H1 TTM</span>
                  </div>
                  <div className="card-main-metric">
                    <span className="card-metric-val tabular-nums text-purple-400">
                      {formatMultiple(evEbitda)}
                    </span>
                    <span className="text-xs text-muted">
                      {peerMedianEvEbitda ? (
                        evEbitda <= peerMedianEvEbitda
                          ? `(피어 대비 ${Math.abs(((evEbitda - peerMedianEvEbitda) / peerMedianEvEbitda) * 100).toFixed(1)}% 낮음)`
                          : `(피어 대비 ${Math.abs(((evEbitda - peerMedianEvEbitda) / peerMedianEvEbitda) * 100).toFixed(1)}% 높음)`
                      ) : ''}
                    </span>
                  </div>
                </div>
                <div className="card-sub-info">
                  <div className="card-info-row">
                    <span>5사 중앙값:</span>
                    <span className="card-info-val tabular-nums">{formatMultiple(peerMedianEvEbitda)}</span>
                  </div>
                  <div className="card-info-row">
                    <span>EV · 시가총액:</span>
                    <span className="card-info-val tabular-nums">
                      {formatKRW(evVal)} / {formatKRW(currentMcap)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: 순차입금, Net Debt, 순현금 여부 */}
              <div className="briefing-top-card">
                <div>
                  <div className="card-top-row">
                    <div className="card-top-title">
                      <ShieldCheck size={16} className="accent-emerald" />
                      <span>자본구조 및 재무 건전성</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${netBorrowing < 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'}`}>
                      {netBorrowing < 0 ? '순현금 상태' : '순차입금 상태'}
                    </span>
                  </div>
                  <div className="card-main-metric">
                    <span className="card-metric-val tabular-nums text-emerald-400">
                      {formatKRW(netBorrowing)}
                    </span>
                    <span className="text-xs text-muted">(순차입금)</span>
                  </div>
                </div>
                <div className="card-sub-info">
                  <div className="card-info-row">
                    <span>Net Debt (리스·신종·비지배 포함):</span>
                    <span className="card-info-val tabular-nums">{formatKRW(netDebt)}</span>
                  </div>
                  <div className="card-info-row">
                    <span>순차입금/EBITDA (TTM):</span>
                    <span className="card-info-val tabular-nums">
                      {netBorrowingEbitda !== null ? `${formatMultiple(netBorrowingEbitda)}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 중단: 핵심 시각화 2개만 배치 */}
            <div className="briefing-mid-widgets">
              {/* 시각화 1: TSR 구성 요약 (주가수익률 + DPS 기반 TSR 보정 효과) */}
              <div className="briefing-widget-card">
                <div>
                  <div className="widget-header-row">
                    <div className="widget-title">
                      <Activity size={16} className="accent-blue" />
                      <span>TSR 구성 분해 (최신 결산: {latest['연도']})</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('A')}
                      className="widget-action-link"
                    >
                      상세 분석 <ArrowRight size={12} />
                    </button>
                  </div>
                  <div className="widget-flow-box">
                    <div className="flow-step-item">
                      <span className="flow-step-label">주가수익률</span>
                      <span className={`flow-step-val tabular-nums ${latestPriceReturn >= 0 ? 'color-pos' : 'color-neg'}`}>
                        {latestPriceReturn !== null ? formatPercent(latestPriceReturn) : '-'}
                      </span>
                    </div>
                    <span className="flow-operator">+</span>
                    <div className="flow-step-item">
                      <span className="flow-step-label">DPS 보정 효과</span>
                      <span className={`flow-step-val tabular-nums ${latestDpsEffect >= 0 ? 'color-pos' : 'color-neg'}`}>
                        {latestDpsEffect !== null ? formatPercentagePoints(latestDpsEffect) : '-'}
                      </span>
                    </div>
                    <span className="flow-operator">=</span>
                    <div className="flow-step-item" style={{ background: 'var(--bg-card)', padding: '0.25rem 0', borderRadius: 'var(--radius-sm)' }}>
                      <span className="flow-step-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{periodKey(selectedPeriod) === '2026H1' ? '반기 TSR' : '연간 TSR'}</span>
                      <span className={`flow-step-val tabular-nums ${latestAnnualTsr >= 0 ? 'color-pos' : 'color-neg'}`}>
                        {latestAnnualTsr !== null ? formatPercent(latestAnnualTsr) : '-'}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="widget-desc">
                  주가 변동에 따른 가격 수익률과 주당배당금(DPS)의 귀속 배당 기여도를 분해하여 주주환원 효과를 명확히 산출합니다.
                </p>
              </div>

              {/* 시각화 2: 시가총액 변동 3요인 분해 요약 (EBITDA 효과 + 배수 효과 + Net Debt 효과) */}
              <div className="briefing-widget-card">
                <div>
                  <div className="widget-header-row">
                    <div className="widget-title">
                      <BarChart3 size={16} className="accent-amber" />
                      <span>
                        시가총액 변동 3요인 분해 ({decomp ? `${decomp.startPeriod} → ${decomp.endPeriod}` : '최근 변동'})
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('B')}
                      className="widget-action-link"
                    >
                      상세 분석 <ArrowRight size={12} />
                    </button>
                  </div>
                  {decomp ? (
                    <div className="widget-flow-box">
                      <div className="flow-step-item">
                        <span className="flow-step-label">EBITDA 효과</span>
                        <span className={`flow-step-val tabular-nums ${decomp.ebitdaEffect >= 0 ? 'color-pos' : 'color-neg'}`}>
                          {decomp.ebitdaEffect >= 0 ? '+' : ''}{formatKRW(decomp.ebitdaEffect)}
                        </span>
                      </div>
                      <span className="flow-operator">+</span>
                      <div className="flow-step-item">
                        <span className="flow-step-label">배수 변동</span>
                        <span className={`flow-step-val tabular-nums ${decomp.multipleEffect >= 0 ? 'color-pos' : 'color-neg'}`}>
                          {decomp.multipleEffect >= 0 ? '+' : ''}{formatKRW(decomp.multipleEffect)}
                        </span>
                      </div>
                      <span className="flow-operator">+</span>
                      <div className="flow-step-item">
                        <span className="flow-step-label">Net Debt 효과</span>
                        <span className={`flow-step-val tabular-nums ${decomp.netDebtEffect >= 0 ? 'color-pos' : 'color-neg'}`}>
                          {decomp.netDebtEffect >= 0 ? '+' : ''}{formatKRW(decomp.netDebtEffect)}
                        </span>
                      </div>
                      <span className="flow-operator">=</span>
                      <div className="flow-step-item" style={{ background: 'var(--bg-card)', padding: '0.25rem 0', borderRadius: 'var(--radius-sm)' }}>
                        <span className="flow-step-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>시총 변동</span>
                        <span className={`flow-step-val tabular-nums ${decomp.deltaMcap >= 0 ? 'color-pos' : 'color-neg'}`}>
                          {decomp.deltaMcap >= 0 ? '+' : ''}{formatKRW(decomp.deltaMcap)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-muted">시가총액 분해 데이터를 산출할 수 없습니다.</div>
                  )}
                </div>
                <p className="widget-desc">
                  기업가치 변동을 이익체력(EBITDA), 시장평가(EV/EBITDA), 재무구조(Net Debt)의 3가지 핵심 기여 요인으로 산술 분해합니다.
                </p>
              </div>
            </div>

            {/* 하단: 한 줄짜리 핵심 유의사항 */}
            <div className="briefing-disclaimer-bar">
              <Info size={15} className="accent-blue flex-shrink-0" />
              <span>
                <strong>핵심 유의사항:</strong> ① 2026H1 수익률·실적은 반기 기준, 배수의 이익은 TTM 기준, 시가총액·Net Debt는 6월 말 기준입니다. ② DPS 기반 보정 효과는 단순 가산 모형으로 실제 배당락일 재투자 기여도와 다를 수 있습니다. ③ 시가총액 분해는 기계적 산술 분해이며 시장 인과관계를 단정하지 않습니다.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. 상세 분석: 탭 분리 (A, B, C, D) */}
      {activeTab === 'A' && (
        <div className="tab-content-wrapper">
          <TsrDecompositionCard 
            companyName={companyName}
            selectedPeriod={selectedPeriod}
            records={records}
            allCompaniesData={allCompaniesData}
          />
        </div>
      )}

      {activeTab === 'B' && (
        <div className="tab-content-wrapper">
          <MarketCapWaterfall 
            companyName={companyName}
            records={records}
          />
        </div>
      )}

      {activeTab === 'C' && (
        <div className="tab-content-wrapper">
          <CapitalStructureWaterfall 
            companyName={companyName}
            selectedPeriod={selectedPeriod}
            records={records}
          />
        </div>
      )}

      {activeTab === 'D' && (
        <div className="tab-content-wrapper">
          <ManagementTrendsChart 
            companyName={companyName}
            records={records}
            allCompaniesData={allCompaniesData}
            theme={theme}
          />
        </div>
      )}
    </div>
  );
}

