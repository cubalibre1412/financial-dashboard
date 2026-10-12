import InfoTooltip from './InfoTooltip';
import usePrintDetails from '../utils/usePrintDetails';
import React, { useState } from 'react';
import { Info, BarChart3, Calendar, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { formatPercent, formatKRW, safeNum, periodKey, formatWonPerShare, formatPercentagePoints } from '../utils/financialCalculators';

export default function TsrDecompositionCard({ 
  companyName, 
  records, 
  allCompaniesData 
}) {
  const printing = usePrintDetails();

  // 전체 연도 목록 (2016 ~ 2025, 2026H1)
  const periods = records.map(r => String(r['연도']));
  const defaultPeriod = periods[periods.length - 1]; // 최신 기간 기본값
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);
  const [isPeerTableOpen, setIsPeerTableOpen] = useState(false);

  // 선택 연도 레코드
  const currentRecord = records.find(r => periodKey(r['연도']) === periodKey(selectedPeriod)) 
    || records[records.length - 1];
  const periodLabel = currentRecord ? String(currentRecord['연도']) : selectedPeriod;
  const is2026H1 = String(periodLabel).includes('2026');

  // 해당 기업 지표 (단위: %)
  const annualTsr = safeNum(currentRecord?.['연간 TSR']);
  const priceRet = safeNum(currentRecord?.['주가수익률(가격 기준)']);
  const dpsEffect = safeNum(currentRecord?.['DPS 기반 TSR 보정 효과']);
  const dpsValue = safeNum(currentRecord?.['DPS']);
  const closePrice = safeNum(currentRecord?.['기말주가']);

  // 피어 6개사 해당 연도 지표 수집 및 중앙값 산출
  const peerList = Object.keys(allCompaniesData || {});
  const peerLabel = `${companyName} 제외 5사`;
  const peerTableRows = peerList.map(pName => {
    const pRecs = allCompaniesData[pName] || [];
    const pRec = pRecs.find(r => periodKey(r['연도']) === periodKey(periodLabel));
    return {
      name: pName,
      isSelf: pName === companyName,
      closePrice: safeNum(pRec?.['기말주가']),
      priceRet: safeNum(pRec?.['주가수익률(가격 기준)']),
      dps: safeNum(pRec?.['DPS']),
      dpsEffect: safeNum(pRec?.['DPS 기반 TSR 보정 효과']),
      tsr: safeNum(pRec?.['연간 TSR'])
    };
  });

  const getMedian = (vals) => {
    const valid = vals.filter(v => v !== null && !isNaN(v));
    if (!valid.length) return null;
    const sorted = [...valid].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const peerMedianTsr = getMedian(peerTableRows.filter(m => m.name !== companyName).map(m => m.tsr));
  const peerMedianPrice = getMedian(peerTableRows.filter(m => m.name !== companyName).map(m => m.priceRet));
  const peerMedianDpsEffect = getMedian(peerTableRows.filter(m => m.name !== companyName).map(m => m.dpsEffect));

  // 방향성 막대 차트 (0 기준선 중심) 스케일 계산
  // 최대 절댓값을 기준으로 0% 중심에서 좌/우 너비 (%) 계산
  const allChartVals = [
    priceRet, dpsEffect, annualTsr,
    peerMedianPrice, peerMedianDpsEffect, peerMedianTsr
  ].filter(v => v !== null && !isNaN(v)).map(v => Math.abs(v));
  const maxAbsVal = Math.max(0.2, ...allChartVals) * 1.15; // 최소 20% 스케일 확보

  const getBarPosition = (val) => {
    if (val === null || isNaN(val)) return { left: '50%', width: '0%' };
    const pctOfMax = (Math.abs(val) / maxAbsVal) * 50; // 한쪽 최대 50%
    if (val >= 0) {
      return {
        left: '50%',
        width: `${Math.min(pctOfMax, 50)}%`,
        isPos: true
      };
    } else {
      return {
        left: `${50 - Math.min(pctOfMax, 50)}%`,
        width: `${Math.min(pctOfMax, 50)}%`,
        isPos: false
      };
    }
  };

  return (
    <div className="briefing-section glass-card p-4 mb-4" data-testid="tsr-decomposition-section">
      {/* 1. 상단: 기준기간 선택 + 1줄 기준 설명 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-glass">
        <div className="flex items-center gap-2">
          <div className="kpi-icon-badge accent-blue">
            <BarChart3 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-base text-primary">TSR 구성 상세 분석</h4>
              {is2026H1 && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  2026 상반기 단일 기간
                </span>
              )}
            </div>
            <p className="text-xs text-secondary mt-0.5">
              산식 기준: <strong>TSR = 주가수익률 + DPS 기반 TSR 보정 효과</strong>
            </p>
          </div>
        </div>

        {/* 기준기간 선택 드롭다운 */}
        <div className="flex items-center gap-2 text-xs self-start sm:self-auto">
          <span className="text-secondary font-semibold flex items-center gap-1">
            <Calendar size={14} className="text-muted" /> 기준기간:
          </span>
          <select 
            id="tsr-period-select"
            value={selectedPeriod} 
            onChange={e => setSelectedPeriod(e.target.value)}
            className="bg-card-subtle text-primary font-bold px-3 py-1.5 rounded border border-glass cursor-pointer focus:outline-none focus:border-blue-400 text-xs"
          >
            {periods.map(p => (
              <option key={`tsr-period-${p}`} value={p} className="bg-slate-900 text-white">
                {p} {String(p).includes('2026') ? '(상반기 단일)' : '연간'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. 핵심 3대 카드 (TSR / 주가수익률 / DPS 보정 효과) */}
      <div className="detail-three-cards">
        {/* Card 1: 총 TSR */}
        <div className="kpi-card glass-card p-3.5 border border-glass">
          <div className="flex items-center justify-between text-xs text-muted mb-1.5">
            <span className="font-semibold text-secondary">
              {is2026H1 ? '2026 상반기 TSR' : `${periodLabel} 연간 TSR`}
            </span>
            <span className="text-xs text-muted">
              {peerLabel} 중앙값: <strong className="text-primary">{formatPercent(peerMedianTsr)}</strong>
            </span>
          </div>
          <div className={`text-2xl font-black tabular-nums ${annualTsr !== null && annualTsr >= 0 ? 'color-pos' : 'color-neg'}`}>
            {annualTsr !== null ? formatPercent(annualTsr) : '—'}
          </div>
          <div className="text-[11px] text-muted mt-1.5 flex items-center justify-between">
            <span>주가수익률 + 귀속 배당 기여</span>
            <span className="font-medium text-xs">({companyName})</span>
          </div>
        </div>

        {/* Card 2: 주가수익률 */}
        <div className="kpi-card glass-card p-3.5 border border-glass">
          <div className="flex items-center justify-between text-xs text-muted mb-1.5">
            <span className="font-semibold text-secondary">주가수익률 (가격 변동)</span>
            <span className="text-xs text-muted">
              {peerLabel} 중앙값: <strong className="text-primary">{formatPercent(peerMedianPrice)}</strong>
            </span>
          </div>
          <div className={`text-2xl font-black tabular-nums ${priceRet !== null && priceRet >= 0 ? 'color-pos' : 'color-neg'}`}>
            {priceRet !== null ? formatPercent(priceRet) : '—'}
          </div>
          <div className="text-[11px] text-muted mt-1.5 flex items-center justify-between">
            <span>(기말주가 − 기초주가) ÷ 기초주가</span>
            <span className="tabular-nums font-mono text-[11px]">기말 {formatWonPerShare(closePrice)}</span>
          </div>
        </div>

        {/* Card 3: DPS 기반 TSR 보정 효과 */}
        <div className="kpi-card glass-card p-3.5 border border-glass">
          <div className="flex items-center justify-between text-xs text-muted mb-1.5">
            <span className="font-semibold text-secondary">DPS 기반 TSR 보정 효과</span>
            <span className="text-xs text-muted">
              {peerLabel} 중앙값: <strong className="text-primary">{peerMedianDpsEffect !== null ? formatPercentagePoints(peerMedianDpsEffect) : '—'}</strong>
            </span>
          </div>
          <div className="text-2xl font-black tabular-nums text-primary">
            {dpsEffect !== null ? formatPercentagePoints(dpsEffect) : '—'}
          </div>
          <div className="text-[11px] text-muted mt-1.5 flex items-center justify-between">
            <span>해당 기간 TSR − 주가수익률</span>
            <span className="tabular-nums font-mono text-[11px]">DPS {formatWonPerShare(dpsValue)}</span>
          </div>
        </div>
      </div>

      {/* 3. 핵심 시각화: 0 기준선 중심 양·음 방향 막대 차트 (Directional Bar Chart) */}
      <div className="directional-chart-box">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-primary flex items-center gap-1.5">
            <Layers size={14} className="accent-blue" />
            0 기준선 양·음 방향 기여도 비교 ({periodLabel})
          </span>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span> 양의 기여(+)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span> 음의 기여(-)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/40 inline-block"></span> {peerLabel} 중앙값
            </span>
          </div>
        </div>

        {/* 막대 차트 컨테이너 */}
        <div className="space-y-4 py-2">
          {/* Row 1: 주가수익률 */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-secondary">주가수익률 (가격 변동)</span>
              <span className="tabular-nums font-bold">
                {companyName}: <span className={priceRet >= 0 ? 'color-pos' : 'color-neg'}>{formatPercent(priceRet)}</span>
                <span className="text-muted font-normal ml-2">(피어 중앙: {formatPercent(peerMedianPrice)})</span>
              </span>
            </div>
            <div className="relative h-6 bg-slate-800/40 rounded overflow-hidden border border-slate-700/50">
              {/* 0% 중심선 */}
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400 z-10"></div>
              {/* 5사 중앙값 마커 */}
              {peerMedianPrice !== null && (
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-sky-400 z-15 opacity-80"
                  style={{ left: `${Math.max(2, Math.min(98, 50 + (peerMedianPrice / maxAbsVal) * 50))}%` }}
                  title={`${peerLabel} 중앙값: ${formatPercent(peerMedianPrice)}`}
                />
              )}
              {/* 기업 막대 */}
              {(() => {
                const pos = getBarPosition(priceRet);
                return (
                  <div 
                    className={`absolute top-1 bottom-1 rounded-sm transition-all duration-300 ${pos.isPos ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ left: pos.left, width: pos.width }}
                  />
                );
              })()}
            </div>
          </div>

          {/* Row 2: DPS 기반 TSR 보정 효과 */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-secondary">DPS 기반 TSR 보정 효과 (배당 기여)</span>
              <span className="tabular-nums font-bold">
                {companyName}: <span className="text-primary">{dpsEffect !== null ? formatPercentagePoints(dpsEffect) : '—'}</span>
                <span className="text-muted font-normal ml-2">(피어 중앙: {formatPercentagePoints(peerMedianDpsEffect)})</span>
              </span>
            </div>
            <div className="relative h-6 bg-slate-800/40 rounded overflow-hidden border border-slate-700/50">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400 z-10"></div>
              {peerMedianDpsEffect !== null && (
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-sky-400 z-15 opacity-80"
                  style={{ left: `${Math.max(2, Math.min(98, 50 + (peerMedianDpsEffect / maxAbsVal) * 50))}%` }}
                  title={`${peerLabel} 중앙값: ${formatPercentagePoints(peerMedianDpsEffect)}`}
                />
              )}
              {(() => {
                const pos = getBarPosition(dpsEffect);
                return (
                  <div 
                    className="absolute top-1 bottom-1 rounded-sm bg-blue-500 transition-all duration-300"
                    style={{ left: pos.left, width: pos.width }}
                  />
                );
              })()}
            </div>
          </div>

          {/* Row 3: 최종 연간 TSR */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-primary">최종 TSR (총수익률 = 주가수익률 + DPS보정)</span>
              <span className="tabular-nums font-bold">
                {companyName}: <span className={annualTsr >= 0 ? 'color-pos' : 'color-neg'}>{formatPercent(annualTsr)}</span>
                <span className="text-muted font-normal ml-2">(피어 중앙: {formatPercent(peerMedianTsr)})</span>
              </span>
            </div>
            <div className="relative h-7 bg-slate-800/60 rounded overflow-hidden border border-slate-600">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-300 z-10"></div>
              {peerMedianTsr !== null && (
                <div 
                  className="absolute top-0 bottom-0 w-1.5 bg-sky-400 z-15 shadow-sm"
                  style={{ left: `${Math.max(2, Math.min(98, 50 + (peerMedianTsr / maxAbsVal) * 50))}%` }}
                  title={`${peerLabel} 중앙값: ${formatPercent(peerMedianTsr)}`}
                />
              )}
              {(() => {
                const pos = getBarPosition(annualTsr);
                return (
                  <div 
                    className={`absolute top-1 bottom-1 rounded-sm transition-all duration-300 ${pos.isPos ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    style={{ left: pos.left, width: pos.width }}
                  />
                );
              })()}
            </div>
          </div>
        </div>

        {/* 축 눈금 라벨 */}
        <div className="flex justify-between text-[10px] text-muted font-mono pt-1">
          <span>-{Math.round(maxAbsVal * 100)}%</span>
          <span>-{Math.round(maxAbsVal * 50)}%</span>
          <span className="font-bold text-secondary">0% (기준선)</span>
          <span>+{Math.round(maxAbsVal * 50)}%</span>
          <span>+{Math.round(maxAbsVal * 100)}%</span>
        </div>
      </div>

      {/* 4. 보조 표: 필요 시에만 열어 상세 비교 */}
      <div className="glass-card rounded-lg border border-glass mb-3 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsPeerTableOpen(!isPeerTableOpen)}
          className="w-full p-3 flex items-center justify-between text-xs font-bold text-primary hover:bg-white/5 transition-colors"
          aria-expanded={isPeerTableOpen}
        >
          <span>피어 6개사 TSR 구성 대조표 ({periodLabel})</span>
          <span className="flex items-center gap-1 text-muted font-normal">{isPeerTableOpen ? '접기' : '상세 보기'} {isPeerTableOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
        </button>
        {(isPeerTableOpen || printing) && <div className="overflow-x-auto border-t border-glass p-3 pt-0">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-glass text-muted bg-card-subtle">
                <th className="py-2 px-2.5 font-semibold">기업명</th>
                <th className="py-2 px-2.5 font-semibold text-right">기말주가</th>
                <th className="py-2 px-2.5 font-semibold text-right">주가수익률</th>
                <th className="py-2 px-2.5 font-semibold text-right">주당배당금(DPS)</th>
                <th className="py-2 px-2.5 font-semibold text-right">DPS 보정 효과</th>
                <th className="py-2 px-2.5 font-semibold text-right">최종 TSR</th>
              </tr>
            </thead>
            <tbody>
              {peerTableRows.map(row => (
                <tr 
                  key={row.name} 
                  className={`border-b border-glass/40 transition-colors ${row.isSelf ? 'bg-blue-500/10 font-bold text-primary' : 'hover:bg-white/5'}`}
                >
                  <td className="py-2 px-2.5 flex items-center gap-1.5">
                    {row.name}
                    {row.isSelf && <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/20 text-blue-400">선택</span>}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono">{formatWonPerShare(row.closePrice)}</td>
                  <td className={`py-2 px-2.5 text-right font-mono tabular-nums ${row.priceRet >= 0 ? 'color-pos' : 'color-neg'}`}>
                    {formatPercent(row.priceRet)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono">{row.dps !== null ? formatWonPerShare(row.dps) : '—'}</td>
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums text-primary">
                    {row.dpsEffect !== null ? formatPercentagePoints(row.dpsEffect) : '—'}
                  </td>
                  <td className={`py-2 px-2.5 text-right font-mono tabular-nums ${row.tsr >= 0 ? 'color-pos' : 'color-neg'}`}>
                    {formatPercent(row.tsr)}
                  </td>
                </tr>
              ))}
              {/* 5사 중앙값 행 */}
              <tr className="bg-card-subtle font-semibold text-secondary">
                <td className="py-2 px-2.5 text-muted">{peerLabel} 중앙값</td>
                <td className="py-2 px-2.5 text-right font-mono">—</td>
                <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatPercent(peerMedianPrice)}</td>
                <td className="py-2 px-2.5 text-right font-mono">—</td>
                <td className="py-2 px-2.5 text-right font-mono tabular-nums">{peerMedianDpsEffect !== null ? formatPercentagePoints(peerMedianDpsEffect) : '—'}</td>
                <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatPercent(peerMedianTsr)}</td>
              </tr>
            </tbody>
          </table>
        </div>}
      </div>

      <div className="briefing-method-note">
        <span>산정 기준</span>
        <InfoTooltip label="TSR 산정 기준 상세" text={`DPS 기반 TSR 보정 효과는 결산 귀속 DPS를 단순 가산한 비재투자 기준의 수익률 차이(%p)입니다. 실제 배당락일 재투자 수익률을 뜻하지 않습니다. ${currentRecord?.['배당 귀속기준 및 반기 특이사항'] || '배당 귀속 특이사항은 원천 자료 확인 필요.'}`} />
      </div>
    </div>
  );
}
