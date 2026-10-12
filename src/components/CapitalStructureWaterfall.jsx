import InfoTooltip from './InfoTooltip';
import usePrintDetails from '../utils/usePrintDetails';
import React, { useState } from 'react';
import { Layers, ShieldCheck, Info, CheckCircle2, ArrowRight, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { formatEok, formatKRW, safeNum, getMarketCap, getNetDebtBroad, getNetBorrowing } from '../utils/financialCalculators';

export default function CapitalStructureWaterfall({ 
  companyName, 
  records 
}) {
  const printing = usePrintDetails();

  // 정렬된 연도 목록
  const periods = records.map(r => String(r['연도']));
  const defaultPeriod = periods[periods.length - 1];
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const currentRecord = records.find(r => String(r['연도']) === String(selectedPeriod)) 
    || records[records.length - 1];
  const periodLabel = currentRecord ? String(currentRecord['연도']) : selectedPeriod;
  const is2026H1 = String(periodLabel).includes('2026');

  // 결산 기준일 자동 판별
  const settlementDateStr = is2026H1 ? '2026.06.30 반기 결산 기준' : `${periodLabel}.12.31 연간 결산 기준`;

  // 원천 재무 항목
  const borrowings = safeNum(currentRecord?.['차입금(원)']) ?? 0;
  const cash = safeNum(currentRecord?.['현금 및 현금성 자산(원)']) ?? 0;
  const shortFin = safeNum(currentRecord?.['단기금융자산(원)']) ?? 0;
  const shortInv = safeNum(currentRecord?.['단기투자자산(원)']) ?? 0;
  const totalCashAndEquiv = cash + shortFin + shortInv;

  const netBorrowing = getNetBorrowing(currentRecord) ?? (borrowings - totalCashAndEquiv);
  const isNetCash = netBorrowing < 0;

  const lease = safeNum(currentRecord?.['리스부채(원)']) ?? 0;
  const hybrid = safeNum(currentRecord?.['신종자본증권(원)']) ?? 0;
  const nonCont = safeNum(currentRecord?.['비지배지분(원)']) ?? 0;
  const totalAdjustments = lease + hybrid + nonCont;

  const netDebt = getNetDebtBroad(currentRecord) ?? (netBorrowing + totalAdjustments);
  const mcap = getMarketCap(currentRecord) ?? 0;
  const ev = safeNum(currentRecord?.['EV(원)']) ?? (mcap + netDebt);

  // 항등식 검증: 시가총액 + Net Debt = EV
  const identityDelta = ev - (mcap + netDebt);
  const hasIdentityInputs = [getMarketCap(currentRecord), getNetDebtBroad(currentRecord), safeNum(currentRecord?.['EV(원)'])].every(v => v !== null);
  const isIdentityValid = hasIdentityInputs && Number.isFinite(identityDelta) && Math.abs(identityDelta) < 1000;

  return (
    <div className="briefing-section glass-card p-4 mb-4" data-testid="capital-structure-section">
      {/* 1. 상단: 기준시점 선택 + 동적 결산일 표시 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-glass">
        <div className="flex items-center gap-2">
          <div className="kpi-icon-badge accent-amber">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-base text-primary">자본구조 · EV 연결 워터폴</h4>
              <span className="kpi-date-tag text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                {settlementDateStr}
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              연결 흐름: 총차입금 → 유동성 차감 → <strong>순차입금</strong> → 추가 EV 조정항목 가산 → <strong>Net Debt</strong> → 시총 가산 → <strong>EV</strong>
            </p>
          </div>
        </div>

        {/* 기준시점 드롭다운 */}
        <div className="flex items-center gap-2 text-xs self-start sm:self-auto">
          <span className="text-secondary font-semibold flex items-center gap-1">
            <Calendar size={14} className="text-muted" /> 기준시점:
          </span>
          <select 
            id="cap-period-select"
            value={selectedPeriod} 
            onChange={e => setSelectedPeriod(e.target.value)}
            className="bg-card-subtle text-primary font-bold px-3 py-1.5 rounded border border-glass cursor-pointer focus:outline-none focus:border-amber-400 text-xs"
          >
            {periods.map(p => (
              <option key={`cap-period-${p}`} value={p} className="bg-slate-900 text-white">
                {p} {String(p).includes('2026') ? '(06.30 기준)' : '(12.31 결산)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. 화면 상단: 핵심 결과 3개 카드 (순차입금, Net Debt, EV) */}
      <div className="detail-three-cards">
        {/* Card 1: 순차입금 (Net Borrowing) */}
        <div className={`kpi-card glass-card p-3.5 border ${isNetCash ? 'border-emerald-500/40 bg-emerald-950/15' : 'border-glass'}`}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-secondary">① 순차입금 (Net Borrowing)</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isNetCash ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'}`}>
              {isNetCash ? '순현금 상태' : '순차입금 상태'}
            </span>
          </div>
          <div className={`text-2xl font-black tabular-nums ${isNetCash ? 'color-pos' : 'text-primary'}`}>
            {formatKRW(netBorrowing)}
          </div>
          <div className="text-[11px] text-muted mt-1.5 flex items-center justify-between">
            <span>이자발생부채 대비 현금 유동성</span>
            <span className="tabular-nums font-mono text-[11px]">차입금 {formatKRW(borrowings)}</span>
          </div>
        </div>

        {/* Card 2: Net Debt (EV 산출용 부채) */}
        <div className="kpi-card glass-card p-3.5 border border-glass">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-secondary">② Net Debt (기업가치 산출용)</span>
            <span className="text-[11px] text-muted">리스·신종·비지배 포함</span>
          </div>
          <div className="text-2xl font-black tabular-nums text-primary">
            {formatKRW(netDebt)}
          </div>
          <div className="text-[11px] text-muted mt-1.5 flex items-center justify-between">
            <span>순차입금 + 추가 EV 조정항목({formatKRW(totalAdjustments)})</span>
            <span className="font-medium text-xs">EV 조정항목</span>
          </div>
        </div>

        {/* Card 3: 기업가치 (EV) */}
        <div className="kpi-card glass-card p-3.5 border border-glass">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-secondary">③ 기업가치 (EV)</span>
            <span className="text-[11px] text-muted">시가총액 + Net Debt</span>
          </div>
          <div className="text-2xl font-black tabular-nums text-purple-400">
            {formatKRW(ev)}
          </div>
          <div className="text-[11px] text-muted mt-1.5 flex items-center justify-between">
            <span>시총 {formatKRW(mcap)} + Net Debt {formatKRW(netDebt)}</span>
            <span className={`font-semibold text-[11px] ${isIdentityValid ? '' : 'color-neg'}`}>{!hasIdentityInputs ? '검증 불가 · 원천값 누락' : isIdentityValid ? '허용오차 내 일치' : '불일치 · 확인 필요'}</span>
          </div>
        </div>
      </div>

      {/* 3. 핵심 시각화: 단계형 좌우 연결 브리지 (Step-by-Step Waterfall Bridge) */}
      <div className="p-4 bg-card-subtle rounded-lg border border-glass mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-primary flex items-center gap-1.5">
            <Layers size={14} className="accent-amber" />
            자본구조에서 기업가치(EV)까지의 6단계 연결 플로우 ({periodLabel})
          </span>
          <span className="text-[11px] text-muted">차입금에서 EV까지 회계적 전환 경로</span>
        </div>

        {/* 6단계 연결 노드 그리드 */}
        <div className="cap-flow-grid">
          {/* Node 1: 총차입금 */}
          <div className="cap-flow-node">
            <div className="text-[11px] text-muted font-medium">1. 총차입금</div>
            <div className="text-sm font-bold tabular-nums text-primary mt-1">{formatKRW(borrowings)}</div>
            <div className="text-[10px] text-muted mt-1">단기+장기차입금</div>
          </div>

          {/* Node 2: 현금/금융/투자 차감 */}
          <div className="cap-flow-node" style={{ background: 'rgba(6, 78, 59, 0.25)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div className="text-[11px] text-emerald-400 font-medium">2. 현금·금융·투자 (-)</div>
            <div className="text-sm font-bold tabular-nums color-pos mt-1">-{formatKRW(totalCashAndEquiv)}</div>
            <div className="text-[10px] text-muted mt-1">현금 {formatKRW(cash)} + 금융투자 {formatKRW(shortFin + shortInv)}</div>
          </div>

          {/* Node 3: 순차입금 (핵심 분기점) */}
          <div className="cap-flow-node" style={{ border: isNetCash ? '2px solid #34d399' : '2px solid #f59e0b', background: isNetCash ? 'rgba(6, 78, 59, 0.4)' : 'rgba(120, 53, 15, 0.25)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-primary">3. 순차입금 (=)</span>
              {isNetCash && <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500 text-slate-900 font-bold">순현금</span>}
            </div>
            <div className={`text-base font-black tabular-nums mt-1 ${isNetCash ? 'color-pos' : 'text-primary'}`}>
              {formatKRW(netBorrowing)}
            </div>
            <div className="text-[10px] text-muted mt-1">차입금 − 현금성자산 합계</div>
          </div>

          {/* Node 4: 리스/신종/비지배 가산 */}
          <div className="cap-flow-node">
            <div className="text-[11px] text-secondary font-medium">4. 추가 EV 조정항목 (+)</div>
            <div className="text-sm font-bold tabular-nums text-primary mt-1">+{formatKRW(totalAdjustments)}</div>
            <div className="text-[10px] text-muted mt-1">리스 {formatKRW(lease)} + 신종/비지배 {formatKRW(hybrid + nonCont)}</div>
          </div>

          {/* Node 5: Net Debt */}
          <div className="cap-flow-node" style={{ border: '2px solid rgba(56, 189, 248, 0.6)', background: 'rgba(30, 41, 59, 0.8)' }}>
            <div className="text-[11px] font-bold text-primary">5. Net Debt (=)</div>
            <div className="text-base font-black tabular-nums text-primary mt-1">{formatKRW(netDebt)}</div>
            <div className="text-[10px] text-muted mt-1">순차입금 + 추가 EV 조정항목</div>
          </div>

          {/* Node 6: 시가총액 가산 및 최종 EV */}
          <div className="cap-flow-node" style={{ border: '2px solid rgba(168, 85, 247, 0.6)', background: 'rgba(88, 28, 135, 0.25)' }}>
            <div className="text-[11px] font-bold text-purple-300">6. 시총 (+) → EV (=)</div>
            <div className="text-base font-black tabular-nums text-purple-300 mt-1">{formatKRW(ev)}</div>
            <div className="text-[10px] text-muted mt-1">시총 {formatKRW(mcap)} + Net Debt {formatKRW(netDebt)}</div>
          </div>
        </div>
      </div>

      {/* 4. 세부 산식 및 원천 계정과목 표 (접기/펼치기) */}
      <div className="glass-card rounded-lg border border-glass mb-3 overflow-hidden">
        <button
          onClick={() => setIsDetailOpen(!isDetailOpen)}
          className="w-full p-3 flex items-center justify-between text-xs font-bold text-primary hover:bg-white/5 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Layers size={14} className="accent-amber" />
            자본구조 세부 원천 계정과목 및 항등식 감사 내역 ({isDetailOpen ? '접기' : '펼쳐보기'})
          </span>
          {isDetailOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {(isDetailOpen || printing) && (
          <div className="p-3 pt-0 border-t border-glass">
            <table className="w-full text-xs text-left border-collapse mt-2">
              <thead>
                <tr className="border-b border-glass text-muted bg-card-subtle">
                  <th className="py-2 px-2.5 font-semibold">계정과목</th>
                  <th className="py-2 px-2.5 font-semibold text-right">원천 금액 (원)</th>
                  <th className="py-2 px-2.5 font-semibold text-right">환산 금액 (억원)</th>
                  <th className="py-2 px-2.5 font-semibold">자본구조 및 EV 산출 내 역할</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-glass/40">
                  <td className="py-1.5 px-2.5">차입금(원)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">{borrowings.toLocaleString()}원</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-primary">{formatEok(borrowings)}</td>
                  <td className="py-1.5 px-2.5 text-muted text-[11px]">단기차입금 + 장기차입금 (이자발생부채)</td>
                </tr>
                <tr className="border-b border-glass/40 text-emerald-400">
                  <td className="py-1.5 px-2.5">현금 및 현금성 자산(원)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">-{cash.toLocaleString()}원</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold">-{formatEok(cash)}</td>
                  <td className="py-1.5 px-2.5 text-muted text-[11px]">원천 현금및현금성자산 차감 (-)</td>
                </tr>
                <tr className="border-b border-glass/40 text-emerald-400">
                  <td className="py-1.5 px-2.5">단기금융자산(원)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">-{shortFin.toLocaleString()}원</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold">-{formatEok(shortFin)}</td>
                  <td className="py-1.5 px-2.5 text-muted text-[11px]">정기예금 등 유동성 금융상품 (-)</td>
                </tr>
                <tr className="border-b border-glass/40 text-emerald-400">
                  <td className="py-1.5 px-2.5">단기투자자산(원)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">-{shortInv.toLocaleString()}원</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold">-{formatEok(shortInv)}</td>
                  <td className="py-1.5 px-2.5 text-muted text-[11px]">단기매매증권 등 현금성 투자자산 (-)</td>
                </tr>
                <tr className="border-b border-glass bg-card-subtle font-bold">
                  <td className="py-2 px-2.5 text-primary">순차입금 (=)</td>
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums">{netBorrowing.toLocaleString()}원</td>
                  <td className={`py-2 px-2.5 text-right font-mono font-black ${isNetCash ? 'color-pos' : 'text-primary'}`}>{formatEok(netBorrowing)}</td>
                  <td className="py-2 px-2.5 text-[11px] text-muted">차입금 − (현금+단기금융+단기투자)</td>
                </tr>
                <tr className="border-b border-glass/40">
                  <td className="py-1.5 px-2.5">리스부채(원)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">+{lease.toLocaleString()}원</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-primary">+{formatEok(lease)}</td>
                  <td className="py-1.5 px-2.5 text-muted text-[11px]">사용권자산 대응 리스부채 (+)</td>
                </tr>
                <tr className="border-b border-glass/40">
                  <td className="py-1.5 px-2.5">신종자본증권(원)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">+{hybrid.toLocaleString()}원</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-primary">+{formatEok(hybrid)}</td>
                  <td className="py-1.5 px-2.5 text-muted text-[11px]">영구채 등 부채성 자본증권 (+)</td>
                </tr>
                <tr className="border-b border-glass/40">
                  <td className="py-1.5 px-2.5">비지배지분(원)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">+{nonCont.toLocaleString()}원</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-primary">+{formatEok(nonCont)}</td>
                  <td className="py-1.5 px-2.5 text-muted text-[11px]">종속회사 외부주주 지분 (+)</td>
                </tr>
                <tr className="border-b border-glass bg-card-subtle font-bold">
                  <td className="py-2 px-2.5 text-primary">Net Debt (=)</td>
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums">{netDebt.toLocaleString()}원</td>
                  <td className="py-2 px-2.5 text-right font-mono font-black text-primary">{formatEok(netDebt)}</td>
                  <td className="py-2 px-2.5 text-[11px] text-muted">순차입금 + 리스부채 + 신종자본 + 비지배지분</td>
                </tr>
                <tr className="border-b border-glass/40">
                  <td className="py-1.5 px-2.5">시가총액 (원천 기준)</td>
                  <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">+{mcap.toLocaleString()}원</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-bold text-primary">+{formatEok(mcap)}</td>
                  <td className="py-1.5 px-2.5 text-muted text-[11px]">원천 엑셀의 시가총액 적용 (+)</td>
                </tr>
                <tr className="bg-purple-500/10 font-black text-xs">
                  <td className="py-2 px-2.5 text-purple-300">기업가치 EV (=)</td>
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums text-purple-300">{ev.toLocaleString()}원</td>
                  <td className="py-2 px-2.5 text-right font-mono font-black text-purple-300">{formatEok(ev)}</td>
                  <td className="py-2 px-2.5 text-emerald-400 font-bold text-[11px]">시가총액 + Net Debt (오차: {Math.round(identityDelta)}원)</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="briefing-method-note">
        <span>지표 정의</span>
        <InfoTooltip label="순차입금과 Net Debt 정의 상세" text="순차입금은 총차입금에서 현금및현금성자산·단기금융자산·단기투자자산을 차감한 이자발생부채 상환부담 지표입니다. Net Debt는 순차입금에 리스부채·신종자본증권·비지배지분을 더한 EV 조정항목입니다. 레버리지 평가는 순차입금/EBITDA를 사용합니다." />
      </div>
    </div>
  );
}
