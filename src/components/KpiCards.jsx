import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Activity, 
  Scale,
  Info
} from 'lucide-react';
import { 
  formatKRW, formatPercent, formatMultiple, formatPeriodLabel,
  getNetDebtBroad, getNetBorrowing, getMarketCap, calculatePeriodReturns,
  isNetCash, safeNum, formatWonPerShare
} from '../utils/financialCalculators';

export default function KpiCards({ 
  companyName: _companyName, 
  currentRecord, 
  prevRecord, 
  allRecords,
  peerAvg 
}) {
  if (!currentRecord) return null;

  const is2026H1 = String(currentRecord['연도'] || '').includes('2026');

  // TSR calculations
  const currentTSR = safeNum(currentRecord['연간 TSR']);

  // 누적 TSR - 10개년(2016~2025) 통일 기준 사용 (원본 수정 완료로 -24.35% 정상 반영)
  const periodReturns = calculatePeriodReturns(allRecords);
  const cumulativeTSR = periodReturns.tsr10Y;

  // 배당 특이사항 열
  const divNote = currentRecord['배당 귀속기준 및 반기 특이사항'];

  // Market Cap
  const currentMcap = getMarketCap(currentRecord);
  const prevMcap = prevRecord ? getMarketCap(prevRecord) : null;
  const mcapGrowth = (prevMcap && prevMcap > 0 && currentMcap !== null) 
    ? (currentMcap - prevMcap) / prevMcap : null;

  // EV / EBITDA & TTM
  const evVal = safeNum(currentRecord['EV(원)']);
  const ebitdaVal = safeNum(currentRecord['EBITDA(원)']);
  const ttmEbitdaVal = safeNum(currentRecord['2026H1 TTM EBITDA(원)']);
  const denominator = is2026H1 ? ttmEbitdaVal : ebitdaVal;
  const evEbitda = denominator !== null && denominator > 0 && evVal !== null ? evVal / denominator : null;

  // EBIT, 순차입금, Net Debt (별도 지표로 명확 분리)
  const ebitVal = safeNum(currentRecord['EBIT(원)']);
  const netBorrowing = getNetBorrowing(currentRecord);
  const netDebt = getNetDebtBroad(currentRecord);
  const roeVal = safeNum(currentRecord['ROE']);

  // 순현금 여부 판정: 순차입금 < 0 기준
  const isNetCashState = isNetCash(currentRecord);

  const peerAvgEvEbitda = safeNum(peerAvg?.evEbitda);
  const isUndervalued = evEbitda && evEbitda > 0 && evEbitda < peerAvgEvEbitda;

  return (
    <div className="kpi-grid">
      {/* 1. 주주총수익률 (TSR) */}
      <div className="kpi-card glass-card">
        <div className="kpi-header">
          <span className="kpi-title">주주총수익률 (TSR)</span>
          <div className={`kpi-icon-badge ${currentTSR >= 0 ? 'positive' : 'negative'}`}>
            <Percent size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className={`kpi-main-val tabular-nums ${currentTSR >= 0 ? 'color-pos' : 'color-neg'}`}>
            {formatPercent(currentTSR)}
          </span>
          <span className="kpi-period-tag">{formatPeriodLabel(currentRecord['연도'], true)}</span>
        </div>
        <div className="kpi-sub-row">
          <span className="kpi-sub-label">공식 10Y TSR ('16초~'25말):</span>
          <span className={`tabular-nums font-semibold flex-center gap-1 ${cumulativeTSR !== null && cumulativeTSR >= 0 ? 'color-pos' : 'color-neg'}`}>
            {cumulativeTSR !== null ? formatPercent(cumulativeTSR, 1) : '데이터 없음'}
          </span>
        </div>
        <div className="kpi-sub-row">
          <span className="kpi-sub-label">
            주당 배당금(DPS):
          </span>
          <span className="tabular-nums font-semibold text-primary flex-center gap-1">
            {formatWonPerShare(currentRecord['DPS'])}
            {divNote && (
              <span className="tooltip-container" title={divNote}>
                <Info size={14} className="text-secondary cursor-help" />
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 2. 시가총액 (Market Cap) */}
      <div className="kpi-card glass-card">
        <div className="kpi-header">
          <span className="kpi-title">시가총액 (Market Cap)</span>
          <div className="kpi-icon-badge accent-blue">
            <DollarSign size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-main-val tabular-nums">
            {formatKRW(currentMcap)}
          </span>
          {is2026H1 && <span className="kpi-date-tag">2026.06.30 기준</span>}
        </div>
        <div className="kpi-sub-row">
          <span className="kpi-sub-label">전기 대비 변동:</span>
          <span className={`tabular-nums flex-center gap-1 ${mcapGrowth !== null && mcapGrowth >= 0 ? 'color-pos' : 'color-neg'}`}>
            {mcapGrowth !== null ? (
              <>
                {mcapGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {formatPercent(mcapGrowth)}
              </>
            ) : '데이터 없음'}
          </span>
        </div>
        <div className="kpi-sub-row">
          <span className="kpi-sub-label">기말 주가:</span>
          <span className="tabular-nums font-semibold text-primary">
            {formatWonPerShare(currentRecord['기말주가'])}
          </span>
        </div>
      </div>

      {/* 3. EV / EBITDA 밸류에이션 배수 */}
      <div className="kpi-card glass-card">
        <div className="kpi-header">
          <span className="kpi-title">
            EV / EBITDA 배수 {is2026H1 && <span className="badge-ttm" title="TTM EBITDA = FY2025 EBITDA − 2025H1 EBITDA + 2026H1 EBITDA (EV 기준일: 2026.06.30)">TTM</span>}
          </span>
          <div className="kpi-icon-badge accent-purple">
            <Scale size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-main-val tabular-nums">
            {formatMultiple(evEbitda)}
          </span>
          <span className={`valuation-status-badge ${isUndervalued ? 'undervalued' : 'premium'}`}>
            {is2026H1 ? '이익: 최근 12개월' : '이익: 연간'}
          </span>
        </div>
        <div className="kpi-sub-row">
          <span className="kpi-sub-label" title="EV = 시가총액 + Net Debt (기준일: 2026.06.30)">
            기업가치(EV):
          </span>
          <span className="tabular-nums font-semibold text-primary">
            {formatKRW(evVal)}
          </span>
        </div>
        <div className="kpi-sub-row">
          <span className="kpi-sub-label" title={is2026H1 ? "2026H1 반기 누적 실적이며 연환산 아님" : "연간 EBITDA"}>
            {is2026H1 ? "EBITDA (반기 누적):" : "EBITDA:"}
          </span>
          <span className="tabular-nums font-semibold text-primary">
            {formatKRW(ebitdaVal)}
          </span>
        </div>
        {is2026H1 && ttmEbitdaVal && (
          <div className="kpi-sub-row text-xs text-secondary">
            <span title="FY2025 − 2025H1 + 2026H1">TTM EBITDA:</span>
            <span className="tabular-nums font-medium">{formatKRW(ttmEbitdaVal)}</span>
          </div>
        )}
      </div>

      {/* 4. 영업이익 및 순차입금·Net Debt (별도 표시) */}
      <div className="kpi-card glass-card">
        <div className="kpi-header">
          <span className="kpi-title">영업이익 {is2026H1 ? '(반기)' : '(연간)'} · 재무구조</span>
          <div className="kpi-icon-badge accent-amber">
            <Activity size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-main-val tabular-nums">
            {formatKRW(ebitVal)}
          </span>
          {isNetCashState ? (
            <span className="netcash-badge" title="순차입금 < 0 (현금성자산 > 차입금)">
              순현금 기업
            </span>
          ) : (
            <span className="netborrow-badge" title="순차입금 > 0 (차입금 > 현금성자산)">
              순차입 상태
            </span>
          )}
        </div>
        <div className="kpi-sub-row">
          <span className="kpi-sub-label" title="순차입금 = 차입금 - (현금 + 단기금융 + 단기투자)">
            순차입금:
          </span>
          <span className="tabular-nums font-semibold text-primary">
            {formatKRW(netBorrowing)}
          </span>
        </div>
        <div className="kpi-sub-row">
          <span className="kpi-sub-label" title="Net Debt = 순차입금 + 리스부채 + 신종자본증권 + 비지배지분 (EV 산출 기준)">
            Net Debt:
          </span>
          <span className="tabular-nums font-semibold text-primary">
            {formatKRW(netDebt)}
          </span>
        </div>
        <div className="kpi-sub-row">
          <span className="kpi-sub-label" title={is2026H1 ? "2026H1 반기 누적 ROE, 연환산 아님" : "자기자본이익률(ROE)"}>
            {is2026H1 ? "ROE (반기 누적, 연환산 아님):" : "ROE:"}
          </span>
          <span className={`tabular-nums font-semibold ${roeVal !== null && roeVal >= 0 ? 'color-pos' : 'color-neg'}`}>
            {roeVal !== null ? `${(roeVal * 100).toFixed(1)}%` : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}
