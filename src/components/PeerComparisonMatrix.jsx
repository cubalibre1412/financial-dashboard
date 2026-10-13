import React, { useState } from 'react';
import { Layers, ArrowUpDown, Sparkles } from 'lucide-react';
import { 
  formatKRW, formatPercent, formatMultiple, formatPeriodLabel, 
  calculatePeriodReturns, getMarketCap, getNetDebtBroad, getNetBorrowing, safeNum, periodKey
} from '../utils/financialCalculators';

export default function PeerComparisonMatrix({ 
  allCompaniesData, 
  onSelectCompany 
}) {
  const [sortField, setSortField] = useState('mcap');
  const [sortAsc, setSortAsc] = useState(false);

  // Extract latest record for each company
  const rows = Object.keys(allCompaniesData).map(name => {
    const records = allCompaniesData[name] || [];
    const latest = records[records.length - 1] || {};
    const periodReturns = calculatePeriodReturns(records);

    const mcap = getMarketCap(latest);
    const ev = safeNum(latest['EV(원)']);
    const netBorrowing = getNetBorrowing(latest);
    const netDebt = getNetDebtBroad(latest);
    const ebit = safeNum(latest['EBIT(원)']);
    const ebitda = safeNum(latest['EBITDA(원)']);
    const evEbitda = safeNum(latest['EV/EBITDA']);
    const per = safeNum(latest['PER']);
    const pbr = safeNum(latest['PBR']);
    const roe = safeNum(latest['ROE']);

    const priceReturn = safeNum(latest['주가수익률(가격 기준)']);
    const dpsEffect = safeNum(latest['DPS 기반 TSR 보정 효과']);
    const nbToEbitda = safeNum(latest['순차입금/EBITDA (2026H1: TTM)']);
    const ebitdaGrowth = safeNum(latest['EBITDA 증감률 (2026H1: TTM vs FY2025)']);

    return {
      name,
      period: formatPeriodLabel(latest['연도'], true),
      stockPrice: Number(latest['기말주가']) || 0,
      tsr1Y: periodReturns.tsr1Y,
      tsr3Y: periodReturns.tsr3Y,
      tsr5Y: periodReturns.tsr5Y,
      tsr10Y: periodReturns.tsr10Y,
      tsr10YChain: periodReturns.tsr10YChain,
      hasShareAnomaly: periodReturns.hasShareAnomaly,
      tsr26H1: periodReturns.tsr26H1,
      priceReturn,
      dpsEffect,
      nbToEbitda,
      ebitdaGrowth,
      mcap,
      netBorrowing,
      netDebt,
      ev,
      ebit,
      ebitda,
      evEbitda,
      per,
      effectiveNetIncome: safeNum(periodKey(latest['연도']) === '2026H1' ? latest['2026H1 TTM 지배주주순이익(원)'] : latest['순이익(원)']),
      pbr,
      roe
    };
  });

  // Sorting
  const sortedRows = [...rows].sort((a, b) => {
    let vA = a[sortField];
    let vB = b[sortField];
    if (vA === undefined || vA === null) vA = -Infinity;
    if (vB === undefined || vB === null) vB = -Infinity;
    return sortAsc ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // ─── 통계 계산 (전체 평균, 중위값, 삼양식품 제외 선택 분석) ───
  const getMedian = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  const calcStats = (field, filterSamyang = false) => {
    const targetRows = rows.filter(r => r.name !== '풀무원' && (!filterSamyang || r.name !== '삼양식품'));
    const vals = targetRows.map(r => r[field]).filter(v => v !== null && v !== undefined && !isNaN(v));
    if (!vals.length) return { avg: null, median: null, count: 0 };
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const median = getMedian(vals);
    return { avg, median, count: vals.length };
  };

  return (
    <div className="table-card glass-card">
      <div className="table-header-box">
        <div className="chart-title-row">
          <Layers className="accent-blue" size={20} />
          <h3 className="chart-title">K-Food 피어 6개사 상세 비교 매트릭스</h3>
        </div>
        <p className="chart-desc peer-matrix-meta" title="TSR은 세전·귀속 DPS·비재투자 단순누적 기준입니다. 순차입금과 Net Debt는 별도 지표이며, EV = 시가총액 + Net Debt입니다.">
          TSR: 귀속 DPS·비재투자 · 열 머리말 클릭 시 정렬 · ⓘ 산식은 각 열의 도움말에서 확인
        </p>
      </div>

      <div className="table-responsive">
        <table className="peer-matrix-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className="cursor-pointer" style={{ width: '8%' }}>
                기업명 <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th style={{ width: '7%' }}>기준시점</th>
              <th onClick={() => handleSort('stockPrice')} className="text-right cursor-pointer" style={{ width: '6.5%' }}>
                기말주가 <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('tsr1Y')} className="text-right cursor-pointer" title="세전·귀속 DPS·비재투자 단순누적 기준의 2025년 연간 TSR" style={{ width: '6.5%' }}>
                '25년 TSR <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('tsr3Y')} className="text-right cursor-pointer" title="최근 3년 ('22년말~'25년말) 누적 TSR" style={{ width: '6.5%' }}>
                3년 누적 <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('tsr10Y')} className="text-right cursor-pointer" title="10개년 ('16년초~'25년말) 누적 TSR" style={{ width: '7.5%' }}>
                10년 누적 <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('mcap')} className="text-right cursor-pointer" style={{ width: '8%' }}>
                시가총액 <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('netBorrowing')} className="text-right cursor-pointer" title="순차입금 = 차입금 - 현금성자산/단기투자 (음수=순현금)" style={{ width: '8%' }}>
                순차입금 <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('netDebt')} className="text-right cursor-pointer" title="Net Debt = 순차입금 + 리스부채 + 신종자본증권 + 비지배지분" style={{ width: '8%' }}>
                Net Debt <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('ev')} className="text-right cursor-pointer" title="EV = 시가총액 + Net Debt" style={{ width: '8%' }}>
                EV <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('ebit')} className="text-right cursor-pointer" style={{ width: '7.5%' }}>
                영업이익 <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('evEbitda')} className="text-right cursor-pointer" title="2026H1은 TTM EBITDA 기준" style={{ width: '6%' }}>
                EV/EBITDA <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('nbToEbitda')} className="text-right cursor-pointer" title="순차입금/EBITDA (2026H1: TTM 기준, EBITDA<=0 미산출)" style={{ width: '6.5%' }}>
                순차입금/EBITDA <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('ebitdaGrowth')} className="text-right cursor-pointer" title="EBITDA 증감률 (2026H1: TTM vs FY2025)" style={{ width: '6%' }}>
                EBITDA증감 <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('per')} className="text-right cursor-pointer" title="2026H1은 TTM 지배주주순이익 기준 (적자시 N/M)" style={{ width: '6%' }}>
                PER <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('pbr')} className="text-right cursor-pointer" style={{ width: '4.5%' }}>
                PBR <ArrowUpDown size={11} className="inline-icon" />
              </th>
              <th onClick={() => handleSort('roe')} className="text-right cursor-pointer" title="2026H1 반기 누적 ROE (연환산 아님)" style={{ width: '4.5%' }}>
                ROE <ArrowUpDown size={11} className="inline-icon" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const isPulmuone = r.name === '풀무원';
              const isDeficit = r.effectiveNetIncome !== null && r.effectiveNetIncome < 0;
              return (
                <tr 
                  key={r.name} 
                  className={`matrix-row ${isPulmuone ? 'pulmuone-row' : ''}`}
                  onClick={() => onSelectCompany(r.name)}
                >
                  <td className="company-cell font-semibold">
                    <div className="company-name-tag">
                      {isPulmuone && <Sparkles size={14} className="color-pos" />}
                      <span>{r.name}</span>
                      {isPulmuone && <span className="badge-hq">본사</span>}
                    </div>
                  </td>
                  <td className="text-muted text-xs">{r.period}</td>
                  <td className="text-right tabular-nums">{r.stockPrice ? `${r.stockPrice.toLocaleString()}원` : '—'}</td>
                  <td className={`text-right tabular-nums font-semibold ${r.tsr1Y >= 0 ? 'color-pos' : 'color-neg'}`}>
                    {formatPercent(r.tsr1Y)}
                  </td>
                  <td className={`text-right tabular-nums font-semibold ${r.tsr3Y >= 0 ? 'color-pos' : 'color-neg'}`}>
                    {formatPercent(r.tsr3Y)}
                  </td>
                  <td className={`text-right tabular-nums font-bold ${r.tsr10Y >= 0 ? 'color-pos' : 'color-neg'}`}>
                    {formatPercent(r.tsr10Y)}
                  </td>
                  <td className="text-right tabular-nums font-medium">{formatKRW(r.mcap)}</td>
                  <td className={`text-right tabular-nums ${r.netBorrowing < 0 ? 'color-pos font-semibold' : ''}`} title={r.netBorrowing < 0 ? '순현금 상태' : ''}>
                    {formatKRW(r.netBorrowing)}
                  </td>
                  <td className="text-right tabular-nums text-primary font-medium">
                    {formatKRW(r.netDebt)}
                  </td>
                  <td className="text-right tabular-nums font-semibold">{formatKRW(r.ev)}</td>
                  <td className="text-right tabular-nums" title="2026H1 반기 누적(연환산 아님)">{formatKRW(r.ebit)}</td>
                  <td className="text-right tabular-nums font-semibold text-primary">
                    {r.evEbitda !== null && r.evEbitda > 0 ? `${r.evEbitda.toFixed(1)}배` : '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.nbToEbitda !== null && r.nbToEbitda !== undefined ? `${r.nbToEbitda.toFixed(1)}배` : '—'}
                  </td>
                  <td className={`text-right tabular-nums font-medium ${r.ebitdaGrowth !== null && r.ebitdaGrowth >= 0 ? 'color-pos' : r.ebitdaGrowth !== null ? 'color-neg' : ''}`}>
                    {r.ebitdaGrowth !== null && r.ebitdaGrowth !== undefined ? formatPercent(r.ebitdaGrowth) : '—'}
                  </td>
                  <td className="text-right tabular-nums font-medium">
                    {isDeficit ? (
                      <span className="text-danger font-semibold" title="TTM 지배주주순이익 적자">N/M (적자)</span>
                    ) : (
                      r.per > 0 ? `${r.per.toFixed(1)}배` : r.effectiveNetIncome === null ? '데이터 없음' : '계산 불가'
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.pbr !== null && r.pbr > 0 ? `${r.pbr.toFixed(2)}배` : '—'}
                  </td>
                  <td className={`text-right tabular-nums font-semibold ${r.roe >= 0 ? 'color-pos' : 'color-neg'}`} title="2026H1 반기 누적 ROE (연환산 아님)">
                    {r.roe !== null ? `${(r.roe * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {/* 1. 전체 피어 평균 (6개사 전체 포함) */}
            <tr className="matrix-stat-row font-semibold">
              <td colSpan={3} className="text-left font-bold">
                5사 평균 (풀무원 제외·보조)
              </td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('tsr1Y').avg)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('tsr3Y').avg)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('tsr10Y').avg)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('mcap').avg)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('netBorrowing').avg)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('netDebt').avg)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('ev').avg)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('ebit').avg)}</td>
              <td className="text-right tabular-nums">{formatMultiple(calcStats('evEbitda').avg)}</td>
              <td className="text-right tabular-nums">{formatMultiple(calcStats('nbToEbitda').avg)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('ebitdaGrowth').avg)}</td>
              <td className="text-right tabular-nums" title="적자·순이익 0·결측 기업은 PER 통계에서 제외">{formatMultiple(calcStats('per').avg)} <small>({calcStats('per').count}/5사)</small></td>
              <td className="text-right tabular-nums">{formatMultiple(calcStats('pbr').avg, 2)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('roe').avg)}</td>
            </tr>
            {/* 2. 5사 중앙값 (풀무원 제외) */}
            <tr className="matrix-stat-row text-muted text-xs">
              <td colSpan={3} className="text-left">
                5사 중앙값 (풀무원 제외)
              </td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('tsr1Y').median)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('tsr3Y').median)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('tsr10Y').median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('mcap').median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('netBorrowing').median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('netDebt').median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('ev').median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('ebit').median)}</td>
              <td className="text-right tabular-nums">{formatMultiple(calcStats('evEbitda').median)}</td>
              <td className="text-right tabular-nums">{formatMultiple(calcStats('nbToEbitda').median)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('ebitdaGrowth').median)}</td>
              <td className="text-right tabular-nums" title="적자·순이익 0·결측 기업은 PER 통계에서 제외">{formatMultiple(calcStats('per').median)} <small>({calcStats('per').count}/5사)</small></td>
              <td className="text-right tabular-nums">{formatMultiple(calcStats('pbr').median, 2)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('roe').median)}</td>
            </tr>
            {/* 3. 삼양식품 제외 평균 (선택 참고 분석) */}
            <tr className="matrix-stat-row text-muted text-xs">
              <td colSpan={3} className="text-left">
                4사 중앙값 (풀무원·삼양 제외)
              </td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('tsr1Y', true).median)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('tsr3Y', true).median)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('tsr10Y', true).median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('mcap', true).median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('netBorrowing', true).median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('netDebt', true).median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('ev', true).median)}</td>
              <td className="text-right tabular-nums">{formatKRW(calcStats('ebit', true).median)}</td>
              <td className="text-right tabular-nums">{formatMultiple(calcStats('evEbitda', true).median)}</td>
              <td className="text-right tabular-nums">{formatMultiple(calcStats('nbToEbitda', true).median)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('ebitdaGrowth', true).median)}</td>
              <td className="text-right tabular-nums" title="적자·순이익 0·결측 기업은 PER 통계에서 제외">{formatMultiple(calcStats('per', true).median)} <small>({calcStats('per', true).count}/4사)</small></td>
              <td className="text-right tabular-nums">{formatMultiple(calcStats('pbr', true).median, 2)}</td>
              <td className="text-right tabular-nums">{formatPercent(calcStats('roe', true).median)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

