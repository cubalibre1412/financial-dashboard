import React, { useMemo, useState } from 'react';
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, Info, Target, TrendingUp } from 'lucide-react';
import {
  calculatePeriodReturns, calculateReinvestedPeriodReturns, formatKRW, formatMultiple,
  formatPercent, getMarketCap, getNetDebtBroad, peerMedian, safeNum
} from '../utils/financialCalculators';

const PERIODS = [
  { key: 'tsr1Y', label: '1Y', range: 'FY2024말 → FY2025말' },
  { key: 'tsr3Y', label: '3Y', range: 'FY2022말 → FY2025말' },
  { key: 'tsr10Y', label: '10Y', range: 'FY2015말 → FY2025말' }
];
const TARGET = { ebitda:2840e8, multiple:7.95, netDebt:14189e8, price:22000, dps:102, tsr:.708 };
const yearRow = (rows, year) => (rows || []).find(r => String(r['연도']).startsWith(String(year)));
const pp = value => value == null ? '—' : `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%p`;
const wealth = value => value == null ? '—' : `₩${Math.round(100 * (1 + value)).toLocaleString('ko-KR')}`;

function indexReturn(rows, name, key) {
  const selected = rows.filter(r => r['지수명'] === name);
  if (key === 'tsr1Y') return safeNum(yearRow(selected, 2025)?.['연간수익률']);
  const start = yearRow(selected, key === 'tsr3Y' ? 2023 : 2016);
  const end = yearRow(selected, 2025);
  const base = safeNum(start?.['기초값']), close = safeNum(end?.['기말값']);
  return base && close != null ? close / base - 1 : null;
}

export default function BoardReportView({ records, allCompaniesData, benchmarkData, onNavigate, onOpenBenchmarks }) {
  const [page, setPage] = useState('DIAGNOSIS');
  const m = useMemo(() => {
    const y16 = yearRow(records, 2016), y25 = yearRow(records, 2025), h1 = yearRow(records, 2026);
    if (!y16 || !y25) return null;
    const actual = calculatePeriodReturns(records), reinvested = calculateReinvestedPeriodReturns(records);
    const peers = Object.entries(allCompaniesData || {}).filter(([n]) => n !== '풀무원')
      .map(([name, rows]) => ({ name, value: calculatePeriodReturns(rows) }));
    const median = (list, key) => peerMedian(list.map(p => p.value[key]));
    const peerRows = PERIODS.map(p => ({...p, pulmuone:actual[p.key], five:median(peers,p.key),
      four:median(peers.filter(x=>x.name!=='삼양식품'),p.key),
      wet:median(peers.filter(x=>['CJ제일제당','대상'].includes(x.name)),p.key)}));
    const krx = benchmarkData?.krx || [];
    const marketRows = PERIODS.map(p => ({...p, pulmuone:reinvested[p.key],
      kospi:indexReturn(krx,'KOSPI',p.key), consumer:indexReturn(krx,'코스피 200 생활소비재',p.key),
      bond:indexReturn(krx,'KRX 채권종합-국채',p.key), apt:indexReturn(krx,'전국 아파트',p.key)}));
    const e16=safeNum(y16['EBITDA(원)']),e25=safeNum(y25['EBITDA(원)']),ev16=safeNum(y16['EV(원)']),ev25=safeNum(y25['EV(원)']);
    const nd16=getNetDebtBroad(y16),nd25=getNetDebtBroad(y25),cap16=getMarketCap(y16),cap25=getMarketCap(y25);
    const base=safeNum(y25['기말주가']), close=safeNum(h1?.['기말주가']);
    const expected=base&&close!=null?(close-base+TARGET.dps)/base:null;
    return {actual,reinvested,peerRows,marketRows,e16,e25,ev16,ev25,nd16,nd25,cap16,cap25,
      share16:cap16/ev16,share25:cap25/ev25,expected,gap:expected==null?null:TARGET.tsr-expected,
    };
  }, [records, allCompaniesData, benchmarkData]);
  if (!m) return <div className="board-report-empty">FY2016·FY2025 공식 평가 데이터를 불러올 수 없습니다.</div>;
  const headline = `EBITDA는 ${formatMultiple(m.e25/m.e16)}로 성장했지만, Net Debt가 ${formatKRW(m.nd25-m.nd16)} 증가해 10년 비재투자 TSR은 ${formatPercent(m.actual.tsr10Y)}에 머물렀습니다.`;

  return (
    <section className="board-report-view" aria-label="풀무원 이사회 보고 View">
      <div className="board-report-switcher" role="tablist" aria-label="이사회 보고 페이지">
        <button role="tab" aria-selected={page==='DIAGNOSIS'} className={page==='DIAGNOSIS'?'active':''} onClick={()=>setPage('DIAGNOSIS')}>① 10년 성과 진단</button>
        <button role="tab" aria-selected={page==='MANAGEMENT'} className={page==='MANAGEMENT'?'active':''} onClick={()=>setPage('MANAGEMENT')}>② 목표·관리체계</button>
      </div>
      {page === 'DIAGNOSIS' ? (
        <div className="board-page">
          <header className="board-message">
            <span className="board-message-kicker">FY2016 → FY2025 공식 성과평가</span>
            <h4>{headline}</h4>
          </header>
          <section className="board-commentary" aria-label="경영진 데이터 기반 코멘트">
            <div className="board-commentary-title"><strong>경영진 코멘트</strong><span>데이터 기반 해석 · 산술관계이며 인과관계 단정 아님</span></div>
            <div className="board-commentary-grid">
              <article><b>장기 구조</b><p>10년간 EBITDA는 {formatPercent(m.e25/m.e16-1)} 성장했지만 EV 증가액 {formatKRW(m.ev25-m.ev16)}보다 Net Debt 증가액 {formatKRW(m.nd25-m.nd16)}이 커 Equity Value는 {formatPercent(m.cap25/m.cap16-1)} 변동했습니다.</p></article>
              <article><b>상대성과</b><p>1Y TSR은 5사 중앙값을 {pp(m.peerRows[0].pulmuone-m.peerRows[0].five)} 상회했으나, 10Y는 5사 중앙값 대비 {pp(m.peerRows[2].pulmuone-m.peerRows[2].five)}입니다. 단기 개선의 장기 격차 해소 여부를 지속 확인해야 합니다.</p></article>
              <article><b>경영 시사점</b><p>EBITDA 성장만으로 주주가치 개선을 보장할 수 없습니다. Net Debt 축소, 현금창출력 개선 및 EV/EBITDA 재평가를 함께 관리지표로 두는 것이 필요합니다.</p></article>
            </div>
          </section>
          <div className="board-diagnosis-grid">
            <article className="board-panel board-panel-performance">
              <div className="board-panel-title"><TrendingUp size={17}/><div><strong>10년 절대성과</strong><span>영업성과 성장과 주주가치의 괴리</span></div></div>
              <div className="board-hero-metric"><b>{formatPercent(m.actual.tsr10Y)}</b><span>비재투자 TSR</span></div>
              <div className="board-metric-list">
                <div><span>EBITDA</span><b>{formatKRW(m.e16)} → {formatKRW(m.e25)}</b><em>{formatMultiple(m.e25/m.e16)}</em></div>
                <div><span>EV</span><b>{formatKRW(m.ev16)} → {formatKRW(m.ev25)}</b><em>{formatKRW(m.ev25-m.ev16)}</em></div>
                <div><span>Net Debt</span><b>{formatKRW(m.nd16)} → {formatKRW(m.nd25)}</b><em className="color-neg">+{formatKRW(m.nd25-m.nd16)}</em></div>
                <div><span>Equity Value</span><b>{formatKRW(m.cap16)} → {formatKRW(m.cap25)}</b><em>{formatPercent(m.cap25/m.cap16-1)}</em></div>
                <div><span>EV 중 Equity</span><b>{formatPercent(m.share16)} → {formatPercent(m.share25)}</b><em>{pp(m.share25-m.share16)}</em></div>
              </div>
              <button className="board-detail-link" onClick={()=>onNavigate('C')}>자본구조 상세 보기 <ArrowRight size={13}/></button>
            </article>
            <article className="board-panel">
              <div className="board-panel-title"><BarChart3 size={17}/><div><strong>피어 상대성과</strong><span>세전·귀속 DPS·비재투자 기준</span></div></div>
              <div className="board-table-wrap"><table className="board-compact-table">
                <thead><tr><th>기간</th><th>풀무원</th><th>5사</th><th>4사*</th><th>Wet Food**</th></tr></thead>
                <tbody>{m.peerRows.map(r=><tr key={r.key}><th>{r.label}<small>{r.range}</small></th><td className={r.pulmuone>=0?'color-pos':'color-neg'}>{formatPercent(r.pulmuone)}</td><td>{formatPercent(r.five)}</td><td>{formatPercent(r.four)}</td><td>{formatPercent(r.wet)}</td></tr>)}</tbody>
              </table></div>
              <p className="board-footnote">* 풀무원·삼양식품 제외 4사 · ** CJ제일제당·대상 2사 중앙값 · 5Y는 상세 화면 참고지표</p>
              <button className="board-detail-link" onClick={()=>onNavigate('D')}>피어 추이 상세 보기 <ArrowRight size={13}/></button>
            </article>
            <article className="board-panel">
              <div className="board-panel-title"><Target size={17}/><div><strong>시장·대체투자 ₩100 비교</strong><span>풀무원 재투자 TSR · 지수 TR · 아파트 PR</span></div></div>
              <div className="board-table-wrap"><table className="board-compact-table board-wealth-table">
                <thead><tr><th>기간</th><th>풀무원</th><th>KOSPI</th><th>소비재</th><th>국채</th><th>전국APT</th></tr></thead>
                <tbody>{m.marketRows.map(r=><tr key={r.key}><th>{r.label}<small>{r.range}</small></th><td>{wealth(r.pulmuone)}<small>{formatPercent(r.pulmuone)}</small></td><td>{wealth(r.kospi)}<small>{formatPercent(r.kospi)}</small></td><td>{wealth(r.consumer)}<small>{formatPercent(r.consumer)}</small></td><td>{wealth(r.bond)}<small>{formatPercent(r.bond)}</small></td><td>{wealth(r.apt)}<small>{formatPercent(r.apt)}</small></td></tr>)}</tbody>
              </table></div>
              <p className="board-footnote">전국 아파트는 가격변동지수(PR)로 임대수익·세금·거래비용을 포함하지 않습니다.</p>
              <button className="board-detail-link" onClick={onOpenBenchmarks}>시장 비교 전체 보기 <ArrowRight size={13}/></button>
            </article>
          </div>
          <div className="board-basis-strip"><Info size={15}/><span><b>측정 기준:</b> 공식 기간 1Y·3Y·10Y · 피어 배당 비재투자 · 시장·대체투자 배당 재투자</span></div>
        </div>
      ) : (
        <div className="board-page">
          <header className="board-message board-message-target">
            <span className="board-message-kicker">PPT v2.9 목표안 · 미승인 시나리오</span>
            <h4>목표 TSR {formatPercent(TARGET.tsr)} 대비 현재 예상 TSR {formatPercent(m.expected)}, Gap은 {pp(m.gap)}입니다.</h4>
            <p>목표·예상·실적은 상태를 구분하며 승인일과 책임자가 입력되기 전에는 확정 경영목표로 표시하지 않습니다.</p>
          </header>
          <div className="board-target-grid">
            <article className="board-panel board-target-score">
              <div className="board-panel-title"><Target size={17}/><div><strong>목표와 전망</strong><span>FY2026 연말 단순누적 TSR</span></div></div>
              <div className="board-score-row">
                <div><span>T-TSR</span><b className="color-pos">{formatPercent(TARGET.tsr)}</b><small>목표안</small></div>
                <div><span>E-TSR</span><b className="color-neg">{formatPercent(m.expected)}</b><small>현재 예상</small></div>
                <div><span>Gap</span><b>{pp(m.gap)}</b><small>해소 필요</small></div>
              </div>
              <div className="board-scenario-assumptions">
                <div><span>목표 EBITDA</span><b>{formatKRW(TARGET.ebitda)}</b></div><div><span>목표 배수</span><b>{formatMultiple(TARGET.multiple)}</b></div>
                <div><span>목표 Net Debt</span><b>{formatKRW(TARGET.netDebt)}</b></div><div><span>목표주가 / DPS</span><b>{TARGET.price.toLocaleString()}원 / {TARGET.dps}원</b></div>
              </div>
              <div className="board-definition-alert"><Info size={14}/><span>목표 TSR 구성과 E-TSR→T-TSR Gap 분해는 서로 다른 분석입니다. 두 기여도 정의가 확정되기 전에는 혼합 차트를 표시하지 않습니다.</span></div>
              <button className="board-detail-link" onClick={()=>onNavigate('SIM')}>시뮬레이션에서 가정 검토 <ArrowRight size={13}/></button>
            </article>
            <article className="board-panel">
              <div className="board-panel-title"><CheckCircle2 size={17}/><div><strong>3단계·8개 관리원칙</strong><span>측정 → 목표 → 거버넌스</span></div></div>
              <ol className="board-principles">
                <li><b>측정</b><span>세전 기준</span><span>귀속 DPS</span><span>피어 비재투자</span></li>
                <li><b>비교·목표</b><span>1Y·3Y·10Y</span><span>4사·5사·Wet Food</span><span>T-TSR·E-TSR·Gap</span></li>
                <li><b>거버넌스</b><span>실행과제</span><span>책임자·완료일</span></li>
              </ol>
              <div className="board-action-empty"><b>실행과제 입력 필요</b><span>책임자·완료예정일·진행상태가 아직 원천 데이터에 없습니다.</span></div>
            </article>
            <article className="board-panel">
              <div className="board-panel-title"><CalendarDays size={17}/><div><strong>연간 보고 주기</strong><span>PPT v2.9 관리안</span></div></div>
              <div className="board-calendar">
                <div><b>9~11월</b><span>차년도 목표안·경영계획 연계</span></div><div><b>12월</b><span>연말 전망·Gap 점검</span></div>
                <div><b>2월</b><span>이사회 실적·목표 보고</span></div><div><b>3월</b><span>주주총회·공개범위 검토</span></div>
                <div><b>7월</b><span>상반기 실적·연말 전망 갱신</span></div>
              </div>
              <p className="board-footnote">일정은 승인 전 관리안입니다. 실제 이사회 일정과 공개 범위는 확정 후 갱신해야 합니다.</p>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}
