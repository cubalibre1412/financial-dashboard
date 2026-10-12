import React, { useState } from 'react';
import { X, Calculator, Sparkles, Building2, CheckCircle2 } from 'lucide-react';
import { 
  calculateTSR, 
  calculateNetBorrowing,
  calculateNetDebtBroad,
  calculateEV, 
  calculateEBITDA, 
  calculateMultiples,
  recalculateRecord,
  formatKRW,
  formatPercent,
  formatMultiple,
  safeNum
} from '../utils/financialCalculators';

export default function DataUpdateModal({
  isOpen,
  onClose,
  companies,
  onSaveRecord,
  initialCompany = '풀무원',
  existingRecords = {}
}) {
  const makeInitialForm = (company) => {
    const recs = existingRecords[company] || [];
    const latest = recs.length > 0 ? recs[recs.length - 1] : null;
    return {
      begPrice: latest && latest['기말주가'] ? String(latest['기말주가']) : '', endPrice: '', dps: '0', finalValue: '', marketCap: '', cash: '', shortFin: '', shortInv: '', borrowings: '', lease: '', hybrid: '', nonControlling: '', ebit: '', depreciation: '', investmentDepr: '', intangibleAmort: '', netIncome: '', equity: ''
    };
  };
  const [targetCompany, setTargetCompany] = useState(initialCompany || '풀무원');
  const [periodYear, setPeriodYear] = useState('2026');
  const [periodType, setPeriodType] = useState('반기'); // '연간' | '반기' | '분기'
  const [periodDetail, setPeriodDetail] = useState('하반기'); // '상반기', '하반기', '1분기', '2분기', '3분기', '4분기'
  const [fvCalcMode, setFvCalcMode] = useState('chain'); // 'chain' (연쇄) | 'manual' (수기)

  const [form, setForm] = useState(() => makeInitialForm(initialCompany || '풀무원'));

  const companyRecords = existingRecords[targetCompany] || [];
  const latestRec = companyRecords.length > 0 ? companyRecords[companyRecords.length - 1] : null;

  if (!isOpen) return null;

  // 실시간 계산
  const numBegPrice = safeNum(form.begPrice);
  const numEndPrice = safeNum(form.endPrice);
  const numDps = safeNum(form.dps) ?? 0;
  const calculatedTSR = calculateTSR(numBegPrice, numEndPrice, numDps);

  // 순차입금 & Net Debt 실시간 계산
  const numBorrowings = safeNum(form.borrowings);
  const numCash = safeNum(form.cash);
  const numShortFin = safeNum(form.shortFin);
  const numShortInv = safeNum(form.shortInv);
  const calculatedNetBorrowing = calculateNetBorrowing(numBorrowings, numCash, numShortFin, numShortInv);

  const numLease = safeNum(form.lease);
  const numHybrid = safeNum(form.hybrid);
  const numNonControlling = safeNum(form.nonControlling);
  const calculatedNetDebt = calculateNetDebtBroad(calculatedNetBorrowing, numLease, numHybrid, numNonControlling);

  // EV = 시가총액 + Net Debt
  const numMarketCap = safeNum(form.marketCap);
  const calculatedEV = calculateEV(numMarketCap, calculatedNetDebt);

  // EBITDA
  const numEbit = safeNum(form.ebit);
  const numDepr = safeNum(form.depreciation);
  const numInvDepr = safeNum(form.investmentDepr);
  const numIntAmort = safeNum(form.intangibleAmort);
  const calculatedEBITDA = calculateEBITDA(numEbit, numDepr, numInvDepr, numIntAmort);

  // Multiples
  const numNetIncome = safeNum(form.netIncome);
  const numEquity = safeNum(form.equity);
  const multiples = calculateMultiples(calculatedEV, calculatedEBITDA, numMarketCap, numNetIncome, numEquity);

  // 최종가치(배당재투자)
  let calculatedFV = safeNum(form.finalValue);
  if (fvCalcMode === 'chain' && latestRec && safeNum(latestRec['최종가치(배당재투자)']) && calculatedTSR !== null) {
    calculatedFV = Math.round(safeNum(latestRec['최종가치(배당재투자)']) * (1 + calculatedTSR) * 100) / 100;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getFullPeriodString = () => {
    // 숫자 2026은 기존 원천에서 H1을 뜻하므로, 신규 연간 입력은 FY를 명시한다.
    if (periodType === '연간') return `${periodYear} FY`;
    if (periodType === '반기') return `${periodYear} ${periodDetail}`;
    return `${periodYear} ${periodDetail}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const periodStr = getFullPeriodString();

    const rawRecord = {
      "연도": periodStr,
      "기초주가": numBegPrice,
      "기말주가": numEndPrice,
      "DPS": numDps,
      "연간 TSR": calculatedTSR,
      "최종가치(배당재투자)": calculatedFV,
      "시가총액(원)": numMarketCap,
      "시가총액 (원)": numMarketCap,
      "차입금(원)": numBorrowings,
      "현금 및 현금성 자산(원)": numCash,
      "단기금융자산(원)": numShortFin,
      "단기투자자산(원)": numShortInv,
      "순차입금(원)": calculatedNetBorrowing,
      "리스부채(원)": numLease,
      "신종자본증권(원)": numHybrid,
      "비지배지분(원)": numNonControlling,
      "Net Debt": calculatedNetDebt,
      "Net Debt(B)": calculatedNetDebt,
      "EV(원)": calculatedEV,
      "EBIT(원)": numEbit,
      "감가상각비(원)": numDepr,
      "투자부동산감가상각비(원)": numInvDepr,
      "무형자산상각비(원)": numIntAmort,
      "EBITDA(원)": calculatedEBITDA,
      "EV/EBITDA": multiples.evEbitda,
      "순이익(원)": numNetIncome,
      "PER": multiples.per,
      "자기자본(원)": numEquity,
      "PBR": multiples.pbr,
      "ROE": multiples.roe !== null ? multiples.roe / 100 : null
    };

    // 통일된 재계산 규칙으로 일관성 보장
    const verifiedRecord = recalculateRecord(rawRecord);
    onSaveRecord(targetCompany, verifiedRecord);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Calculator className="accent-blue" size={20} />
            </div>
            <div>
              <h3 className="modal-title">신규 기간 실적 입력 및 자동 지표 갱신</h3>
              <p className="modal-subtitle">
                순차입금, Net Debt, EV, EBITDA 및 TSR 의존관계를 일괄 자동 산출합니다. (미입력과 0 구분)
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* 1. 대상 기업 및 기간 설정 */}
          <div className="form-section">
            <h4 className="section-title">
              <Building2 size={16} className="accent-blue" />
              1. 대상 기업 및 기간 선택
            </h4>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">대상 기업</label>
                <select 
                  className="form-select"
                  value={targetCompany}
                  onChange={e => {
                    const company = e.target.value;
                    setTargetCompany(company);
                    setForm(makeInitialForm(company));
                  }}
                >
                  {(companies || ['풀무원', 'CJ제일제당', '농심', '삼양식품', '대상', '오뚜기']).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">연도</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={periodYear}
                  onChange={e => setPeriodYear(e.target.value)}
                  placeholder="예: 2026"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">주기 구분</label>
                <div className="flex gap-2">
                  <select 
                    className="form-select"
                    value={periodType}
                    onChange={e => setPeriodType(e.target.value)}
                  >
                    <option value="연간">연간</option>
                    <option value="반기">반기</option>
                    <option value="분기">분기</option>
                  </select>
                  {periodType !== '연간' && (
                    <select 
                      className="form-select"
                      value={periodDetail}
                      onChange={e => setPeriodDetail(e.target.value)}
                    >
                      {periodType === '반기' ? (
                        <>
                          <option value="상반기">상반기</option>
                          <option value="하반기">하반기</option>
                        </>
                      ) : (
                        <>
                          <option value="1분기">1분기</option>
                          <option value="2분기">2분기</option>
                          <option value="3분기">3분기</option>
                          <option value="4분기">4분기</option>
                        </>
                      )}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. 주가 및 배당 (TSR) */}
          <div className="form-section">
            <h4 className="section-title">
              <Sparkles size={16} className="accent-green" />
              2. 주가 및 배당 (TSR 산출)
            </h4>
            <div className="form-grid-4">
              <div className="form-group">
                <label className="form-label">기초 주가 (원)</label>
                <input 
                  type="number" 
                  name="begPrice"
                  className="form-input"
                  value={form.begPrice}
                  onChange={handleInputChange}
                  placeholder="기초주가"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">기말 주가 (원)</label>
                <input 
                  type="number" 
                  name="endPrice"
                  className="form-input"
                  value={form.endPrice}
                  onChange={handleInputChange}
                  placeholder="기말주가"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">주당 배당금 DPS (원)</label>
                <input 
                  type="number" 
                  name="dps"
                  className="form-input"
                  value={form.dps}
                  onChange={handleInputChange}
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">최종가치(배당재투자)</label>
                <div className="flex gap-1">
                  <input 
                    type="number" 
                    name="finalValue"
                    className="form-input"
                    value={fvCalcMode === 'chain' ? (calculatedFV || '') : form.finalValue}
                    onChange={handleInputChange}
                    disabled={fvCalcMode === 'chain'}
                    placeholder={fvCalcMode === 'chain' ? '자동연쇄산출' : '수기입력'}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-xs"
                    onClick={() => setFvCalcMode(prev => prev === 'chain' ? 'manual' : 'chain')}
                    title="연쇄계산 또는 수기입력 전환"
                  >
                    {fvCalcMode === 'chain' ? '수기전환' : '연쇄전환'}
                  </button>
                </div>
              </div>
            </div>
            <div className="preview-calc-box">
              <span>👉 산출 당기 TSR: <strong>{formatPercent(calculatedTSR)}</strong></span>
              {fvCalcMode === 'chain' && latestRec && (
                <span className="text-xs text-muted ml-3">
                  (이전 최종가치 {safeNum(latestRec['최종가치(배당재투자)'])?.toLocaleString()}원 × (1 + TSR) 연쇄적용)
                </span>
              )}
            </div>
          </div>

          {/* 3. 재무 구성항목 (순차입금 & Net Debt) */}
          <div className="form-section">
            <h4 className="section-title">
              <Calculator size={16} className="accent-amber" />
              3. 재무 구성항목 (순차입금 및 Net Debt)
            </h4>
            <p className="text-xs text-secondary mb-2">
              순차입금 = 차입금 - (현금 + 단기금융 + 단기투자) | Net Debt = 순차입금 + 리스부채 + 신종자본증권 + 비지배지분
            </p>
            <div className="form-grid-4">
              <div className="form-group">
                <label className="form-label">차입금(원)</label>
                <input 
                  type="number" 
                  name="borrowings"
                  className="form-input"
                  value={form.borrowings}
                  onChange={handleInputChange}
                  placeholder="단기+장기 차입금"
                />
              </div>
              <div className="form-group">
                <label className="form-label">현금및현금성자산(원)</label>
                <input 
                  type="number" 
                  name="cash"
                  className="form-input"
                  value={form.cash}
                  onChange={handleInputChange}
                  placeholder="현금성자산"
                />
              </div>
              <div className="form-group">
                <label className="form-label">단기금융자산(원)</label>
                <input 
                  type="number" 
                  name="shortFin"
                  className="form-input"
                  value={form.shortFin}
                  onChange={handleInputChange}
                  placeholder="단기금융자산"
                />
              </div>
              <div className="form-group">
                <label className="form-label">단기투자자산(원)</label>
                <input 
                  type="number" 
                  name="shortInv"
                  className="form-input"
                  value={form.shortInv}
                  onChange={handleInputChange}
                  placeholder="단기투자자산"
                />
              </div>
            </div>

            <div className="form-grid-3 mt-2">
              <div className="form-group">
                <label className="form-label">리스부채(원)</label>
                <input 
                  type="number" 
                  name="lease"
                  className="form-input"
                  value={form.lease}
                  onChange={handleInputChange}
                  placeholder="유동+비유동 리스부채"
                />
              </div>
              <div className="form-group">
                <label className="form-label">신종자본증권(원)</label>
                <input 
                  type="number" 
                  name="hybrid"
                  className="form-input"
                  value={form.hybrid}
                  onChange={handleInputChange}
                  placeholder="신종자본증권"
                />
              </div>
              <div className="form-group">
                <label className="form-label">비지배지분(원)</label>
                <input 
                  type="number" 
                  name="nonControlling"
                  className="form-input"
                  value={form.nonControlling}
                  onChange={handleInputChange}
                  placeholder="비지배지분"
                />
              </div>
            </div>

            <div className="preview-calc-box flex justify-between">
              <span>👉 산출 순차입금: <strong>{formatKRW(calculatedNetBorrowing)}</strong>{calculatedNetBorrowing !== null && calculatedNetBorrowing < 0 ? ' (순현금 상태)' : ''}</span>
              <span>👉 산출 Net Debt: <strong>{formatKRW(calculatedNetDebt)}</strong></span>
            </div>
          </div>

          {/* 4. 시가총액, 손익, 자본 (EV & 배수) */}
          <div className="form-section">
            <h4 className="section-title">
              <Calculator size={16} className="accent-purple" />
              4. 시가총액, 손익, 자본 (EV & EBITDA & 배수)
            </h4>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">시가총액 (원)</label>
                <input 
                  type="number" 
                  name="marketCap"
                  className="form-input"
                  value={form.marketCap}
                  onChange={handleInputChange}
                  placeholder="기말 시가총액"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">영업이익 EBIT (원)</label>
                <input 
                  type="number" 
                  name="ebit"
                  className="form-input"
                  value={form.ebit}
                  onChange={handleInputChange}
                  placeholder="영업이익"
                />
              </div>
              <div className="form-group">
                <label className="form-label">감가상각비 (원)</label>
                <input 
                  type="number" 
                  name="depreciation"
                  className="form-input"
                  value={form.depreciation}
                  onChange={handleInputChange}
                  placeholder="유형+사용권 감가상각비"
                />
              </div>
            </div>

            <div className="form-grid-4 mt-2">
              <div className="form-group">
                <label className="form-label">투자부동산감가상각(원)</label>
                <input 
                  type="number" 
                  name="investmentDepr"
                  className="form-input"
                  value={form.investmentDepr}
                  onChange={handleInputChange}
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">무형자산상각비(원)</label>
                <input 
                  type="number" 
                  name="intangibleAmort"
                  className="form-input"
                  value={form.intangibleAmort}
                  onChange={handleInputChange}
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">당기순이익 (원)</label>
                <input 
                  type="number" 
                  name="netIncome"
                  className="form-input"
                  value={form.netIncome}
                  onChange={handleInputChange}
                  placeholder="순이익"
                />
              </div>
              <div className="form-group">
                <label className="form-label">자기자본 (원)</label>
                <input 
                  type="number" 
                  name="equity"
                  className="form-input"
                  value={form.equity}
                  onChange={handleInputChange}
                  placeholder="자본총계"
                />
              </div>
            </div>

            <div className="preview-calc-box flex flex-wrap gap-4">
              <span>👉 산출 EV: <strong>{formatKRW(calculatedEV)}</strong> (시가총액 + Net Debt)</span>
              <span>👉 EBITDA: <strong>{formatKRW(calculatedEBITDA)}</strong></span>
              <span>👉 EV/EBITDA: <strong>{formatMultiple(multiples.evEbitda)}</strong></span>
              <span>👉 PER: <strong>{formatMultiple(multiples.per)}</strong></span>
              <span>👉 PBR: <strong>{formatMultiple(multiples.pbr, 2)}</strong></span>
              <span>👉 ROE: <strong>{multiples.roe !== null ? `${multiples.roe.toFixed(1)}%` : '-'}</strong></span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn-primary flex-center gap-2">
              <CheckCircle2 size={16} />
              <span>실적 데이터 저장 및 지표 반영</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
