import InfoTooltip from './InfoTooltip';
import usePrintDetails from '../utils/usePrintDetails';
import React, { useState } from 'react';
import { ArrowRight, Layers, Info, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatEok as formatKRW, safeNum, getMarketCap, getNetDebtBroad, decomposeMarketCapChange } from '../utils/financialCalculators';

export default function MarketCapWaterfall({ 
  companyName, 
  records 
}) {
  const printing = usePrintDetails();

  // 정렬된 연도 목록
  const periods = records.map(r => String(r['연도']));
  
  // 기본 선택: 시작 = 2025년 (직전 결산), 종료 = 2026H1 (최신)
  const defaultEnd = periods[periods.length - 1]; 
  const defaultStart = periods.length >= 2 ? periods[periods.length - 2] : periods[0];

  const [startPeriod, setStartPeriod] = useState(defaultStart);
  const [endPeriod, setEndPeriod] = useState(defaultEnd);
  const [validationError, setValidationError] = useState(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const handleStartChange = (val) => {
    const startIndex = periods.indexOf(val);
    const endIndex = periods.indexOf(endPeriod);
    if (startIndex >= endIndex) {
      setValidationError('시작기간은 종료기간보다 과거 시점이어야 합니다.');
      return;
    }
    setValidationError(null);
    setStartPeriod(val);
  };

  const handleEndChange = (val) => {
    const startIndex = periods.indexOf(startPeriod);
    const endIndex = periods.indexOf(val);
    if (startIndex >= endIndex) {
      setValidationError('종료기간은 시작기간보다 미래 시점이어야 합니다.');
      return;
    }
    setValidationError(null);
    setEndPeriod(val);
  };

  const startRecord = records.find(r => String(r['연도']) === String(startPeriod));
  const endRecord = records.find(r => String(r['연도']) === String(endPeriod));

  const isEnd2026H1 = String(endPeriod).includes('2026');

  // 분해 엔진 실행
  const decomp = (startRecord && endRecord && startPeriod !== endPeriod) 
    ? decomposeMarketCapChange(startRecord, endRecord) 
    : null;

  // 워터폴 차트 누적 좌표 산출
  // 시작 시총 -> +EBITDA효과 -> +배수효과 -> +NetDebt효과 -> 종료 시총
  let waterfallSteps = [];
  if (decomp) {
    const startM = decomp.startMcap;
    const eEff = decomp.ebitdaEffect;
    const mEff = decomp.multipleEffect;
    const nEff = decomp.netDebtEffect;
    const endM = decomp.endMcap;

    const step1End = startM;
    const step2Start = step1End;
    const step2End = step2Start + eEff;
    const step3Start = step2End;
    const step3End = step3Start + mEff;
    const step4Start = step3End;
    const step4End = step4Start + nEff;

    const allLevels = [0, startM, step2End, step3End, step4End, endM];
    const minLevel = Math.min(...allLevels);
    const maxLevel = Math.max(...allLevels);
    const range = Math.max(maxLevel - minLevel, 1);

    waterfallSteps = [
      {
        label: `시작 시총\n(${decomp.startPeriod})`,
        shortLabel: '시작 시총',
        period: decomp.startPeriod,
        value: startM,
        diff: startM,
        type: 'total',
        startVal: 0,
        endVal: startM
      },
      {
        label: '① EBITDA\n기여 효과',
        shortLabel: 'EBITDA 효과',
        value: eEff,
        diff: eEff,
        type: eEff >= 0 ? 'increase' : 'decrease',
        startVal: Math.min(step2Start, step2End),
        endVal: Math.max(step2Start, step2End)
      },
      {
        label: '② EV/EBITDA\n배수 효과',
        shortLabel: '배수 효과',
        value: mEff,
        diff: mEff,
        type: mEff >= 0 ? 'increase' : 'decrease',
        startVal: Math.min(step3Start, step3End),
        endVal: Math.max(step3Start, step3End)
      },
      {
        label: '③ Net Debt\n변동 효과',
        shortLabel: 'Net Debt 효과',
        value: nEff,
        diff: nEff,
        type: nEff >= 0 ? 'increase' : 'decrease',
        startVal: Math.min(step4Start, step4End),
        endVal: Math.max(step4Start, step4End)
      },
      {
        label: `종료 시총\n(${decomp.endPeriod})`,
        shortLabel: '종료 시총',
        period: decomp.endPeriod,
        value: endM,
        diff: endM,
        type: 'total',
        startVal: 0,
        endVal: endM
      }
    ].map(s => {
      const bottomPct = ((s.startVal - minLevel) / range) * 100;
      const heightPct = (Math.abs(s.endVal - s.startVal) / range) * 100;
      return {
        ...s,
        bottomPct: Math.max(0, Math.min(bottomPct, 100)),
        heightPct: Math.max(heightPct, 2) // 최소 2% 가시성
      };
    });
  }

  // 계산 엔진의 반환 필드(sumEffect)를 기준으로 항등식을 검증한다.
  // 기존 화면은 존재하지 않는 sumOfEffects를 참조해 NaN/"데이터 없음"을 표시했다.
  const sumEffects = decomp ? safeNum(decomp.sumEffect ?? decomp.sumOfEffects) : 0;
  const actualError = decomp ? safeNum(decomp.deltaMcap) - sumEffects : 0;
  const actualErrorStr = Math.abs(actualError) < 1 ? '0원' : formatKRW(actualError);

  return (
    <div className="briefing-section glass-card p-4 mb-4" data-testid="market-cap-waterfall-section">
      {/* 1. 상단: 시작/종료기간 선택 및 TTM 기준 안내 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-glass">
        <div className="flex items-center gap-2">
          <div className="kpi-icon-badge accent-purple">
            <Layers size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-base text-primary">시가총액 변동 3대 요인 분해 (Market Cap Bridge)</h4>
              {isEnd2026H1 && (
                <span className="badge-ttm text-[11px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  EBITDA 및 EV/EBITDA: TTM 기준
                </span>
              )}
            </div>
            <p className="text-xs text-secondary mt-0.5">
              핵심 공식: <strong>시가총액 = EBITDA × (EV/EBITDA) − Net Debt</strong>
            </p>
          </div>
        </div>

        {/* 시작 및 종료 시점 선택기 */}
        <div className="flex items-center gap-2 text-xs self-start md:self-auto flex-wrap">
          <div className="flex items-center gap-1.5 bg-card-subtle px-2.5 py-1.5 rounded border border-glass">
            <span className="text-muted font-semibold">시작:</span>
            <select 
              id="mcap-start-period-select"
              value={startPeriod} 
              onChange={e => handleStartChange(e.target.value)}
              className="bg-transparent text-primary font-bold focus:outline-none cursor-pointer text-xs"
            >
              {periods.map(p => (
                <option key={`start-${p}`} value={p} className="bg-slate-900 text-white">
                  {p}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight size={14} className="text-muted" />

          <div className="flex items-center gap-1.5 bg-card-subtle px-2.5 py-1.5 rounded border border-glass">
            <span className="text-muted font-semibold">종료:</span>
            <select 
              id="mcap-end-period-select"
              value={endPeriod} 
              onChange={e => handleEndChange(e.target.value)}
              className="bg-transparent text-primary font-bold focus:outline-none cursor-pointer text-xs"
            >
              {periods.map(p => (
                <option key={`end-${p}`} value={p} className="bg-slate-900 text-white">
                  {p} {String(p).includes('2026') ? '(6월 말 / 이익 TTM)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 유효성 경고 문구 */}
      {validationError && (
        <div className="p-3 mb-4 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {!decomp ? (
        <div className="p-6 text-center text-xs text-muted">
          선택한 기간(시작: {startPeriod}, 종료: {endPeriod})의 시가총액 변동을 분해할 수 없습니다. 서로 다른 올바른 기간을 선택해 주세요.
        </div>
      ) : (
        <>
          {/* 2. 핵심 시각화: 실제 누적 워터폴 차트 (Waterfall Bridge) */}
          <div className="waterfall-chart-box">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-primary">
                시가총액 변동 누적 워터폴 ({decomp.startPeriod} → {decomp.endPeriod})
              </span>
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block"></span> 기준/종료 시총
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span> 긍정적 기여(+)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span> 부정적 기여(-)
                </span>
              </div>
            </div>

            {/* 워터폴 차트 캔버스 */}
            <div className="waterfall-track-container">
              {waterfallSteps.map((step, idx) => {
                const isTotal = step.type === 'total';
                const isPos = step.type === 'increase';
                const barClass = isTotal ? 'waterfall-bar-total' : (isPos ? 'waterfall-bar-pos' : 'waterfall-bar-neg');

                return (
                  <div key={`wf-step-${idx}`} className="waterfall-step-col">
                    {/* 상단 수치 라벨 */}
                    <div 
                      className="waterfall-val-label"
                      style={{ bottom: `calc(${step.bottomPct + step.heightPct}% + 4px)` }}
                    >
                      <span className={`text-[11px] font-bold font-mono tabular-nums block ${isTotal ? 'text-primary' : (isPos ? 'color-pos' : 'color-neg')}`}>
                        {!isTotal && step.value >= 0 ? '+' : ''}{formatKRW(step.value)}
                      </span>
                    </div>

                    {/* 플로팅 워터폴 막대 */}
                    <div 
                      className={`waterfall-step-bar ${barClass}`}
                      style={{ 
                        bottom: `${step.bottomPct}%`, 
                        height: `${step.heightPct}%` 
                      }}
                      title={`${step.shortLabel}: ${formatKRW(step.value)}`}
                    />

                    {/* 하단 축 라벨 */}
                    <div className="waterfall-axis-label">
                      <span className="text-[11px] font-semibold text-secondary leading-tight block">
                        {step.shortLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 축 보조 설명 */}
            <div className="flex justify-between items-center text-[10px] text-muted pt-8">
              <span>* 금액 단위: 억원 (1조원 = 10,000억원)</span>
              <span>Net Debt 감소는 시가총액 증가 요인(+)으로 반영됩니다.</span>
            </div>
          </div>

          {/* 3. 산식 대조표는 기본 숨김: 워터폴 해석에 집중 */}
          <div className="glass-card rounded-lg border border-glass mb-3 overflow-hidden">
            <button type="button" onClick={() => setIsAuditOpen(!isAuditOpen)} className="w-full p-3 flex items-center justify-between text-xs font-bold text-primary hover:bg-white/5 transition-colors" aria-expanded={isAuditOpen}>
              <span>시가총액 3대 요인 분해 산식 대조표</span>
              <span className="flex items-center gap-1 text-muted font-normal">{isAuditOpen ? '접기' : '산식 상세 보기'} {isAuditOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
            </button>
            {(isAuditOpen || printing) && <div className="overflow-x-auto border-t border-glass p-3 pt-0">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-glass text-muted bg-card-subtle">
                    <th className="py-2 px-2.5 font-semibold">분해 구분</th>
                    <th className="py-2 px-2.5 font-semibold">세부 산식 및 원천 구성치</th>
                    <th className="py-2 px-2.5 font-semibold text-right">변동 기여 금액</th>
                    <th className="py-2 px-2.5 font-semibold text-right">순변동 대비 비중</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 시작 시총 */}
                  <tr className="border-b border-glass/40 text-muted">
                    <td className="py-2 px-2.5 font-semibold">시작 시가총액 ({decomp.startPeriod})</td>
                    <td className="py-2 px-2.5 font-mono text-[11px]">기초 기준 시가총액</td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold text-primary">{formatKRW(decomp.startMcap)}</td>
                    <td className="py-2 px-2.5 text-right text-muted font-mono">—</td>
                  </tr>

                  {/* 1. EBITDA 효과 */}
                  <tr className="border-b border-glass/40">
                    <td className="py-2 px-2.5 font-semibold text-secondary">① EBITDA 기여 효과</td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-muted">
                      ΔEBITDA({formatKRW(decomp.deltaEbitda)}) × 평균배수({((decomp.startMultiple + decomp.endMultiple)/2).toFixed(2)}배)
                    </td>
                    <td className={`py-2 px-2.5 text-right font-mono font-bold tabular-nums ${decomp.ebitdaEffect >= 0 ? 'color-pos' : 'color-neg'}`}>
                      {decomp.ebitdaEffect >= 0 ? '+' : ''}{formatKRW(decomp.ebitdaEffect)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-muted tabular-nums">
                      {decomp.deltaMcap !== 0 ? `${((decomp.ebitdaEffect / decomp.deltaMcap) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>

                  {/* 2. Multiple 효과 */}
                  <tr className="border-b border-glass/40">
                    <td className="py-2 px-2.5 font-semibold text-secondary">② EV/EBITDA 배수 효과</td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-muted">
                      평균EBITDA({formatKRW((decomp.startEbitda + decomp.endEbitda)/2)}) × ΔMultiple({decomp.deltaMultiple >= 0 ? '+' : ''}{decomp.deltaMultiple.toFixed(2)}배)
                    </td>
                    <td className={`py-2 px-2.5 text-right font-mono font-bold tabular-nums ${decomp.multipleEffect >= 0 ? 'color-pos' : 'color-neg'}`}>
                      {decomp.multipleEffect >= 0 ? '+' : ''}{formatKRW(decomp.multipleEffect)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-muted tabular-nums">
                      {decomp.deltaMcap !== 0 ? `${((decomp.multipleEffect / decomp.deltaMcap) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>

                  {/* 3. Net Debt 효과 */}
                  <tr className="border-b border-glass/40">
                    <td className="py-2 px-2.5 font-semibold text-secondary">③ Net Debt 변동 효과</td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-muted">
                      −ΔNet Debt (Net Debt 변동액: {decomp.deltaNetDebt >= 0 ? '+' : ''}{formatKRW(decomp.deltaNetDebt)})
                    </td>
                    <td className={`py-2 px-2.5 text-right font-mono font-bold tabular-nums ${decomp.netDebtEffect >= 0 ? 'color-pos' : 'color-neg'}`}>
                      {decomp.netDebtEffect >= 0 ? '+' : ''}{formatKRW(decomp.netDebtEffect)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-muted tabular-nums">
                      {decomp.deltaMcap !== 0 ? `${((decomp.netDebtEffect / decomp.deltaMcap) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>

                  {/* 분해 합계 */}
                  <tr className="border-b border-glass bg-card-subtle/50 font-bold">
                    <td className="py-2 px-2.5 text-primary">3개 요인 분해 합계</td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-muted">① EBITDA효과 + ② 배수효과 + ③ Net Debt효과</td>
                    <td className={`py-2 px-2.5 text-right font-mono tabular-nums ${sumEffects >= 0 ? 'color-pos' : 'color-neg'}`}>
                      {sumEffects >= 0 ? '+' : ''}{formatKRW(sumEffects)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-primary">{decomp.deltaMcap !== 0 ? `${(sumEffects / decomp.deltaMcap * 100).toFixed(1)}%` : '—'}</td>
                  </tr>

                  {/* 실제 시가총액 변동 */}
                  <tr className="border-b border-glass font-bold">
                    <td className="py-2 px-2.5 text-primary">실제 시가총액 변동액 (ΔMcap)</td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-muted">
                      종료 시총({formatKRW(decomp.endMcap)}) − 시작 시총({formatKRW(decomp.startMcap)})
                    </td>
                    <td className={`py-2 px-2.5 text-right font-mono tabular-nums ${decomp.deltaMcap >= 0 ? 'color-pos' : 'color-neg'}`}>
                      {decomp.deltaMcap >= 0 ? '+' : ''}{formatKRW(decomp.deltaMcap)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono">—</td>
                  </tr>

                  {/* 항등식 오차 */}
                  <tr className="bg-emerald-500/5 font-semibold text-xs">
                    <td className="py-2 px-2.5 text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      항등식 오차 (실제 오차 계산치)
                    </td>
                    <td className="py-2 px-2.5 text-[11px] text-muted">실제 시총 변동액 − 3개 요인 분해 합계</td>
                    <td className="py-2 px-2.5 text-right font-mono text-emerald-400 tabular-nums font-bold">
                      {actualErrorStr}
                    </td>
                    <td className="py-2 px-2.5 text-right text-emerald-400 font-mono text-[11px]">{Number.isFinite(actualError) && Math.abs(actualError) < 1000 ? '허용오차 내 일치' : '불일치 · 확인 필요'}</td>
                  </tr>
                </tbody>
              </table>
            </div>}
          </div>

          <div className="briefing-method-note">
            <span>분해 기준</span>
            <InfoTooltip label="시가총액 분해 기준 상세" text="시가총액 변동은 Mcap = EBITDA × EV/EBITDA − Net Debt 항등식에 따른 기계적 산술 분해입니다. 시장 평가 또는 경영 성과의 인과관계를 단정하지 않습니다. Net Debt 변동에는 리스부채·신종자본증권·비지배지분이 포함됩니다." />
          </div>
        </>
      )}
    </div>
  );
}
