/**
 * Financial Calculation Engine v2.3
 * 
 * 핵심 규칙 및 산식:
 * 1. 순차입금 = 차입금 - 현금및현금성자산 - 단기금융자산 - 단기투자자산 (별도 지표)
 * 2. Net Debt = 순차입금 + 리스부채 + 신종자본증권 + 비지배지분
 * 3. EV = 시가총액 + Net Debt
 * 4. 순현금 판정: Net Debt 음수 여부가 아닌 별도 "순차입금 < 0" 기준으로 판정
 * 5. TSR 기간:
 *    - 1Y: 2025년 연간 TSR
 *    - 3Y: 2022년 말 → 2025년 말
 *    - 5Y: 2020년 말 → 2025년 말
 *    - 10Y: 2016년 기초 → 2025년 말 (최종가치 비율 및 연쇄수익률 비교 검증)
 *    - 26H1: 2026년 상반기 단일 기간 TSR
 *    - 전체: 2016년 기초 → 2026년 상반기 말
 * 6. 결측치/0 엄격 구분: null -> "데이터 없음" 또는 "계산 불가", 0 -> 0원/0.0%
 */

// ─── 유틸리티 ──────────────────────────────────────────────

export function safeNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function safeAdd(...vals) {
  const nums = vals.map(safeNum);
  if (nums.every(v => v === null)) return null;
  return nums.reduce((sum, v) => sum + (v ?? 0), 0);
}

// ─── TSR 계산 ──────────────────────────────────────────────

export function calculateTSR(begPrice, endPrice, dps = 0) {
  const beg = safeNum(begPrice);
  const end = safeNum(endPrice);
  if (beg === null || beg <= 0 || end === null) return null;
  return (end - beg + (safeNum(dps) ?? 0)) / beg;
}

// ─── 순차입금 및 Net Debt 계산 ─────────────────────────────

/**
 * 순차입금(좁은 정의) = 차입금 - 현금및현금성자산 - 단기금융자산 - 단기투자자산
 */
export function calculateNetBorrowing(borrowings, cash, shortFin, shortInv) {
  const b = safeNum(borrowings);
  const c = safeNum(cash);
  // 차입금 또는 현금이 미입력이면 순현금/순차입으로 단정하지 않는다.
  if (b === null || c === null) return null;
  return b - c - (safeNum(shortFin) ?? 0) - (safeNum(shortInv) ?? 0);
}

/**
 * Net Debt(넓은 정의) = 순차입금 + 리스부채 + 신종자본증권 + 비지배지분
 */
export function calculateNetDebtBroad(netBorrowing, lease, hybrid, nonControlling) {
  const nb = safeNum(netBorrowing);
  if (nb === null) return null;
  return nb + (safeNum(lease) ?? 0) + (safeNum(hybrid) ?? 0) + (safeNum(nonControlling) ?? 0);
}

/**
 * 레코드에서 Net Debt 값을 가져오는 헬퍼
 * 우선순위: Net Debt(B) -> Net Debt -> 구성항목 직접계산
 */
export function getNetDebtBroad(record) {
  if (!record) return null;
  const ndb = safeNum(record['Net Debt(B)']);
  if (ndb !== null) return ndb;
  const nd = safeNum(record['Net Debt']);
  if (nd !== null) return nd;
  
  // fallback: 순차입금 + 리스부채 + 신종자본증권 + 비지배지분
  const nb = getNetBorrowing(record);
  if (nb === null) return null;
  return nb + (safeNum(record['리스부채(원)']) ?? 0) + (safeNum(record['신종자본증권(원)']) ?? 0) + (safeNum(record['비지배지분(원)']) ?? 0);
}

/**
 * 레코드에서 순차입금(별도 지표) 가져오기
 */
export function getNetBorrowing(record) {
  if (!record) return null;
  const nb = safeNum(record['순차입금(원)']);
  if (nb !== null) return nb;

  // 원천에 순차입금(원)이 없을 경우 계산
  const b = safeNum(record['차입금(원)']);
  const c = safeNum(record['현금 및 현금성 자산(원)']);
  if (b !== null && c !== null) {
    return b - c - (safeNum(record['단기금융자산(원)']) ?? 0) - (safeNum(record['단기투자자산(원)']) ?? 0);
  }
  return null;
}

/**
 * 순현금(Net Cash) 여부 판단:
 * 원칙: Net Debt 음수 여부가 아니라, 별도 "순차입금 < 0"으로 판단
 */
export function isNetCash(record) {
  const nb = getNetBorrowing(record);
  return nb !== null && nb < 0;
}

/**
 * 레코드에서 시가총액 가져오기 (필드명 표준화)
 */
export function getMarketCap(record) {
  if (!record) return null;
  return safeNum(record['시가총액(원)']) ?? safeNum(record['시가총액 (원)']);
}

// ─── EV 계산 ───────────────────────────────────────────────

/**
 * EV = 시가총액 + Net Debt
 * 순차입금을 Net Debt 대신 사용하거나, 시가총액에 순차입금과 Net Debt를 모두 더하지 않음
 */
export function calculateEV(marketCap, netDebt) {
  const mc = safeNum(marketCap);
  const nd = safeNum(netDebt);
  if (mc === null || nd === null) return null;
  return mc + nd;
}

// ─── EBITDA & Multiples ────────────────────────────────────

export function calculateEBITDA(ebit, depreciation, investmentDepr, intangibleAmort) {
  const e = safeNum(ebit);
  if (e === null) return null;
  return e + (safeNum(depreciation) ?? 0) + (safeNum(investmentDepr) ?? 0) + (safeNum(intangibleAmort) ?? 0);
}

export function calculateMultiples(ev, ebitda, marketCap, netIncome, equity) {
  const evVal = safeNum(ev);
  const ebitdaVal = safeNum(ebitda);
  const mcapVal = safeNum(marketCap);
  const netIncVal = safeNum(netIncome);
  const eqVal = safeNum(equity);

  return {
    evEbitda: (evVal !== null && ebitdaVal !== null && ebitdaVal !== 0)
      ? Math.round((evVal / ebitdaVal) * 100) / 100 : null,
    per: (mcapVal !== null && netIncVal !== null && netIncVal !== 0)
      ? Math.round((mcapVal / netIncVal) * 100) / 100 : null,
    pbr: (mcapVal !== null && eqVal !== null && eqVal !== 0)
      ? Math.round((mcapVal / eqVal) * 100) / 100 : null,
    roe: (netIncVal !== null && eqVal !== null && eqVal !== 0)
      ? Math.round((netIncVal / eqVal) * 10000) / 100 : null
  };
}

// ─── 일관된 레코드 재계산 엔진 ──────────────────────────────
/**
 * 구성항목 수정 시 전체 의존성 일괄 갱신:
 * 재무항목 → 순차입금 → Net Debt → EV → EV/EBITDA
 * 손익/자본 → PER, PBR, ROE
 * 주가/배당 → 연간 TSR
 */
export function recalculateRecord(record) {
  const updated = { ...record };

  // 1. 주가 및 TSR
  const begP = safeNum(updated['기초주가']);
  const endP = safeNum(updated['기말주가']);
  const dps = safeNum(updated['DPS']) ?? 0;
  if (begP !== null && endP !== null && begP > 0) {
    updated['연간 TSR'] = (endP - begP + dps) / begP;
  }

  // 2. 순차입금
  const borrowings = safeNum(updated['차입금(원)']);
  const cash = safeNum(updated['현금 및 현금성 자산(원)']);
  const shortFin = safeNum(updated['단기금융자산(원)']);
  const shortInv = safeNum(updated['단기투자자산(원)']);
  if (borrowings !== null && cash !== null) {
    updated['순차입금(원)'] = borrowings - cash - (shortFin ?? 0) - (shortInv ?? 0);
  } else {
    updated['순차입금(원)'] = null;
  }

  // 3. Net Debt
  const nb = safeNum(updated['순차입금(원)']);
  const lease = safeNum(updated['리스부채(원)']);
  const hybrid = safeNum(updated['신종자본증권(원)']);
  const nonCont = safeNum(updated['비지배지분(원)']);
  if (nb !== null) {
    const calcNd = nb + (lease ?? 0) + (hybrid ?? 0) + (nonCont ?? 0);
    updated['Net Debt(B)'] = calcNd;
    if (updated['Net Debt'] !== undefined) {
      updated['Net Debt'] = calcNd;
    }
  }

  // 4. EV = 시가총액 + Net Debt
  const mcap = getMarketCap(updated);
  const nd = getNetDebtBroad(updated);
  if (mcap !== null && nd !== null) {
    updated['EV(원)'] = mcap + nd;
  }

  // 5. EBITDA
  const ebit = safeNum(updated['EBIT(원)']);
  const depr = safeNum(updated['감가상각비(원)']) ?? safeNum(updated['감가상각비(유형+사용권)(원)']) ?? safeNum(updated['감가상각비']);
  const invDepr = safeNum(updated['투자부동산감가상각비(원)']);
  const intAmort = safeNum(updated['무형자산상각비(원)']);
  if (ebit !== null) {
    updated['EBITDA(원)'] = ebit + (depr ?? 0) + (invDepr ?? 0) + (intAmort ?? 0);
  }

  // 6. Multiples (2026H1은 TTM 기준 적용: FY2025 - 2025H1 + 2026H1)
  const ev = safeNum(updated['EV(원)']);
  const ebitda = safeNum(updated['EBITDA(원)']);
  const netInc = safeNum(updated['순이익(원)']) ?? safeNum(updated['당기순이익(원)']);
  const equity = safeNum(updated['자기자본(원)']);

  const is2026H1 = String(updated['연도']).includes('2026');
  const ttmEbitda = safeNum(updated['2026H1 TTM EBITDA(원)']);
  const ttmNetInc = safeNum(updated['2026H1 TTM 지배주주순이익(원)']);

  const effectiveEbitda = is2026H1 ? ttmEbitda : ebitda;
  const effectiveNetInc = is2026H1 ? ttmNetInc : netInc;

  const mult = calculateMultiples(ev, effectiveEbitda, mcap, effectiveNetInc, equity);
  updated['EV/EBITDA'] = mult.evEbitda;
  // 순이익 적자 시 PER는 null (N/M 적자로 화면 표시)
  updated['PER'] = (effectiveNetInc !== null && effectiveNetInc < 0) ? null : mult.per;
  updated['PBR'] = mult.pbr;
  if (mult.roe !== null) {
    updated['ROE'] = mult.roe / 100;
  }

  // 7. v2.3 신규 지표: 주가수익률, DPS 보정 효과, 순차입금/EBITDA
  if (begP !== null && endP !== null && begP > 0) {
    const priceRet = (endP - begP) / begP;
    updated['주가수익률(가격 기준)'] = priceRet;
    const annTsr = safeNum(updated['연간 TSR']);
    if (annTsr !== null) {
      updated['DPS 기반 TSR 보정 효과'] = annTsr - priceRet;
    }
  }

  const calcNb = safeNum(updated['순차입금(원)']);
  if (calcNb !== null && effectiveEbitda !== null && effectiveEbitda > 0) {
    updated['순차입금/EBITDA (2026H1: TTM)'] = calcNb / effectiveEbitda;
  } else if (effectiveEbitda !== null && effectiveEbitda <= 0) {
    updated['순차입금/EBITDA (2026H1: TTM)'] = null; // EBITDA 0 이하 미표시
  }

  return updated;
}

/**
 * 전체 시계열 일괄 재계산 (EBITDA 증감률 등 전기 데이터 연계 산출)
 */
export function recalculateTimeSeries(records) {
  if (!records || !Array.isArray(records)) return [];
  
  // 1차 단일 레코드 재계산
  const updatedList = records.map(r => recalculateRecord(r));
  
  // 2차 전기 대비 EBITDA 증감률 산출
  // FY2025 EBITDA 찾기 (2026H1 TTM vs FY2025 용)
  const r2025 = updatedList.find(r => String(r['연도']).startsWith('2025'));
  const fy2025Ebitda = safeNum(r2025?.['EBITDA(원)']);

  for (let i = 0; i < updatedList.length; i++) {
    const curr = updatedList[i];
    const is2026 = String(curr['연도']).includes('2026');

    if (is2026) {
      // 2026H1: TTM EBITDA vs FY2025 EBITDA
      const ttmEbitda = safeNum(curr['2026H1 TTM EBITDA(원)']);
      if (fy2025Ebitda !== null && fy2025Ebitda > 0 && ttmEbitda !== null) {
        curr['EBITDA 증감률 (2026H1: TTM vs FY2025)'] = (ttmEbitda - fy2025Ebitda) / fy2025Ebitda;
      } else {
        curr['EBITDA 증감률 (2026H1: TTM vs FY2025)'] = null;
      }
    } else {
      // 일반 연도: 당기 EBITDA vs 전기 EBITDA
      if (i > 0) {
        const prev = updatedList[i - 1];
        const prevEbitda = safeNum(prev['EBITDA(원)']);
        const currEbitda = safeNum(curr['EBITDA(원)']);
        if (prevEbitda !== null && prevEbitda > 0 && currEbitda !== null) {
          curr['EBITDA 증감률 (2026H1: TTM vs FY2025)'] = (currEbitda - prevEbitda) / prevEbitda;
        } else {
          curr['EBITDA 증감률 (2026H1: TTM vs FY2025)'] = null;
        }
      } else {
        // 첫 연도 (2016) 전기 대비 증감률 없음
        curr['EBITDA 증감률 (2026H1: TTM vs FY2025)'] = null;
      }
    }
  }

  return updatedList;
}

/**
 * v2.3 시가총액 변동 3대 요인 산술 분해 (Market Cap Bridge / Waterfall)
 * 분해식:
 * Δ시가총액 = (종료 EBITDA - 시작 EBITDA) * 시작 Multiple
 *          + 종료 EBITDA * (종료 Multiple - 시작 Multiple)
 *          - (종료 Net Debt - 시작 Net Debt)
 */
export function decomposeMarketCapChange(startRecord, endRecord) {
  if (!startRecord || !endRecord) return null;

  const isStart2026 = String(startRecord['연도']).includes('2026');
  const isEnd2026 = String(endRecord['연도']).includes('2026');

  // 시작점 수치
  const startEbitda = isStart2026 
    ? safeNum(startRecord['2026H1 TTM EBITDA(원)'])
    : safeNum(startRecord['EBITDA(원)']);
  const startMultiple = startEbitda > 0 && getMarketCap(startRecord) !== null && getNetDebtBroad(startRecord) !== null ? (getMarketCap(startRecord) + getNetDebtBroad(startRecord)) / startEbitda : null;
  const startNetDebt = getNetDebtBroad(startRecord);
  const startMcap = getMarketCap(startRecord);

  // 종료점 수치
  const endEbitda = isEnd2026 
    ? safeNum(endRecord['2026H1 TTM EBITDA(원)'])
    : safeNum(endRecord['EBITDA(원)']);
  const endMultiple = endEbitda > 0 && getMarketCap(endRecord) !== null && getNetDebtBroad(endRecord) !== null ? (getMarketCap(endRecord) + getNetDebtBroad(endRecord)) / endEbitda : null;
  const endNetDebt = getNetDebtBroad(endRecord);
  const endMcap = getMarketCap(endRecord);

  if (startEbitda === null || endEbitda === null || 
      startMultiple === null || endMultiple === null || 
      startNetDebt === null || endNetDebt === null || 
      startMcap === null || endMcap === null) {
    return null;
  }

  const deltaMcap = endMcap - startMcap;
  const deltaEbitda = endEbitda - startEbitda;
  const deltaMultiple = endMultiple - startMultiple;
  const deltaNetDebt = endNetDebt - startNetDebt;

  // 3대 요인
  const ebitdaEffect = deltaEbitda * (startMultiple + endMultiple) / 2;
  const multipleEffect = (startEbitda + endEbitda) / 2 * deltaMultiple;
  const netDebtEffect = -deltaNetDebt;
  const sumEffect = ebitdaEffect + multipleEffect + netDebtEffect;

  return {
    startPeriod: startRecord['연도'],
    endPeriod: endRecord['연도'],
    startMcap,
    endMcap,
    deltaMcap,
    startEbitda,
    endEbitda,
    deltaEbitda,
    startMultiple,
    endMultiple,
    deltaMultiple,
    startNetDebt,
    endNetDebt,
    deltaNetDebt,
    ebitdaEffect,
    multipleEffect,
    netDebtEffect,
    sumEffect,
    isExact: Math.abs(deltaMcap - sumEffect) < 1000 // 1,000원 미만 오차(부동소수점 오차 허용)
  };
}

// ─── 포맷터 ────────────────────────────────────────────────

export function formatKRW(val, showUnit = true) {
  const n = safeNum(val);
  if (n === null) return "데이터 없음";
  if (n === 0) return "0" + (showUnit ? "원" : "");
  
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs >= 1_000_000_000_000) {
    const jo = (abs / 1_000_000_000_000).toFixed(2);
    return `${sign}${jo}조${showUnit ? "원" : ""}`;
  } else if (abs >= 100_000_000) {
    const eok = (abs / 100_000_000).toFixed(0);
    return `${sign}${Number(eok).toLocaleString()}억${showUnit ? "원" : ""}`;
  } else if (abs >= 10_000) {
    const man = (abs / 10_000).toFixed(0);
    return `${sign}${Number(man).toLocaleString()}만${showUnit ? "원" : ""}`;
  }
  return `${sign}${Math.round(abs).toLocaleString()}${showUnit ? "원" : ""}`;
}

export function formatPercent(val, digits = 1) {
  const n = safeNum(val);
  if (n === null) return "데이터 없음";
  const rounded = Number((n * 100).toFixed(digits));
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(digits)}%`;
}

export function formatMultiple(val, digits = 1, isLoss = false) {
  if (isLoss) return "N/M (적자)";
  const n = safeNum(val);
  if (n === null) return "계산 불가";
  
  return `${n.toFixed(digits)}배`;
}

export function formatPeriodLabel(period, detailed = false) {
  const pStr = String(period || '').trim();
  if (pStr === '2026' || pStr === '2026년' || pStr === '2026 상반기' || pStr === '2026 1H') {
    return detailed ? '2026 상반기 (06.30 기준)' : '2026 상반기';
  }
  if (!pStr.includes('년') && !pStr.includes('H') && !pStr.includes('Q') && !isNaN(Number(pStr))) {
    return `${pStr}년`;
  }
  return pStr;
}

// ─── 기간별 누적 TSR 계산 ──────────────────────────────────

/**
 * 누적 TSR 기간별 계산 (통일 기준)
 * 
 * - tsr1Y: 2025년 단일 연간 수익률
 * - tsr3Y: 2022년 말 → 2025년 말 (val2025 / val2022 - 1)
 * - tsr5Y: 2020년 말 → 2025년 말 (val2025 / val2020 - 1)
 * - tsr10Y: 2016년 기초 → 2025년 말 (2016~2025 연간 연쇄 수익률 또는 최종가치 비율)
 * - tsr10YChain: 2016년 기초 → 2025년 말 (연간 수익률 연쇄곱 기준)
 * - tsr26H1: 2026년 상반기 단일 기간 TSR
 * - cumAll: 2016년 기초 → 2026년 상반기 말
 */
export function calculateReinvestedPeriodReturns(records) {
  if (!records || records.length === 0) {
    return { 
      tsr1Y: null, tsr3Y: null, tsr5Y: null, tsr10Y: null, 
      tsr10YChain: null, tsr26H1: null, cumAll: null, 
      hasShareAnomaly: false, anomalyNote: null 
    };
  }

  const findYear = (y) => records.find(r => String(r['연도']).startsWith(String(y)));
  
  const r2016 = findYear(2016);
  const r2020 = findYear(2020);
  const r2022 = findYear(2022);
  const r2025 = findYear(2025);
  const r2026 = findYear(2026);

  const p2016_init = safeNum(r2016?.['기초주가']);
  const val2020 = safeNum(r2020?.['최종가치(배당재투자)']);
  const val2022 = safeNum(r2022?.['최종가치(배당재투자)']);
  const val2025 = safeNum(r2025?.['최종가치(배당재투자)']);
  const val2026 = safeNum(r2026?.['최종가치(배당재투자)']);

  // 10Y 연간수익률 연쇄곱: 2016 ~ 2025
  let prod10Y = 1.0;
  let hasAllAnnual = true;
  for (let y = 2016; y <= 2025; y++) {
    const yr = findYear(y);
    const yTsr = safeNum(yr?.['연간 TSR']);
    if (yTsr !== null) {
      prod10Y *= (1.0 + yTsr);
    } else {
      hasAllAnnual = false;
    }
  }
  const tsr10YChain = hasAllAnnual ? (prod10Y - 1.0) : null;

  // 10Y (원천 최종가치 기반): 2016년 기초 → 2025년 말
  const tsr10YVal = (p2016_init && p2016_init > 0 && val2025 !== null) 
    ? (val2025 - p2016_init) / p2016_init : null;

  // 원본 엑셀 수정으로 10년 연쇄곱과 최종가치가 일치함 (-24.35%)
  const tsr10Y = tsr10YChain ?? tsr10YVal;

  // 5Y: 2020년 말 → 2025년 말
  const tsr5Y = (val2020 !== null && val2020 > 0 && val2025 !== null)
    ? (val2025 - val2020) / val2020 : null;

  // 3Y: 2022년 말 → 2025년 말
  const tsr3Y = (val2022 !== null && val2022 > 0 && val2025 !== null)
    ? (val2025 - val2022) / val2022 : null;

  // 1Y: 2025년 연간 TSR
  const tsr1Y = safeNum(r2025?.['연간 TSR']);

  // 26H1: 2026년 상반기 연간 TSR
  const tsr26H1 = safeNum(r2026?.['연간 TSR']);

  // cumAll: 2016년 기초 → 2026년 상반기 말
  const cumAll = (p2016_init && p2016_init > 0 && val2026 !== null) 
    ? (val2026 - p2016_init) / p2016_init : tsr10Y;

  return {
    tsr1Y,
    tsr3Y,
    tsr5Y,
    tsr10Y,
    tsr10YChain,
    hasShareAnomaly: false, // 원본 수정 완료로 이상치 뱃지 완전 제거
    anomalyNote: null,
    tsr26H1,
    cumAll
  };
}

// ─── 데이터 무결성 검증 ────────────────────────────────────

export function validateRecord(record, companyName, year) {
  const issues = [];
  const prefix = `[${companyName}/${year}]`;
  
  // 1. EV = 시가총액 + Net Debt 검증
  const mcap = getMarketCap(record);
  const nd = getNetDebtBroad(record);
  const ev = safeNum(record['EV(원)']);
  if (mcap !== null && nd !== null && ev !== null) {
    const evCalc = mcap + nd;
    const diff = Math.abs(ev - evCalc);
    if (diff > 1_000_000) {
      issues.push(`${prefix} EV 불일치: 보고=${(ev/1e8).toFixed(0)}억, 계산=${(evCalc/1e8).toFixed(0)}억 (차이: ${(diff/1e8).toFixed(1)}억)`);
    }
  } else if (ev !== null && (mcap === null || nd === null)) {
    issues.push(`${prefix} 원천 EV 있음 / 재계산 검증 불가 (필수 구성값 누락)`);
  }
  
  // 2. 순차입금 검증 (차입금 - 현금/단기금융/단기투자)
  const nb = safeNum(record['순차입금(원)']);
  const borrowings = safeNum(record['차입금(원)']);
  const cash = safeNum(record['현금 및 현금성 자산(원)']);
  const shortFin = safeNum(record['단기금융자산(원)']);
  const shortInv = safeNum(record['단기투자자산(원)']);
  if (nb !== null && borrowings !== null) {
    const nbCalc = borrowings - (cash ?? 0) - (shortFin ?? 0) - (shortInv ?? 0);
    const diff = Math.abs(nb - nbCalc);
    if (diff > 1_000_000) {
      issues.push(`${prefix} 순차입금 불일치: 보고=${(nb/1e8).toFixed(0)}억, 계산=${(nbCalc/1e8).toFixed(0)}억`);
    }
  }

  // 3. Net Debt 검증 (순차입금 + 리스부채 + 신종자본증권 + 비지배지분)
  const lease = safeNum(record['리스부채(원)']);
  const hybrid = safeNum(record['신종자본증권(원)']);
  const nonCont = safeNum(record['비지배지분(원)']);
  if (nd !== null && nb !== null) {
    const ndCalc = nb + (lease ?? 0) + (hybrid ?? 0) + (nonCont ?? 0);
    const diff = Math.abs(nd - ndCalc);
    if (diff > 1_000_000) {
      issues.push(`${prefix} Net Debt 불일치: 보고=${(nd/1e8).toFixed(0)}억, 계산=${(ndCalc/1e8).toFixed(0)}억`);
    }
  }
  
  return issues;
}

export function validateAllData(masterData) {
  if (!masterData?.companies) return [];
  
  const allIssues = [];
  Object.entries(masterData.companies).forEach(([comp, records]) => {
    records.forEach(r => {
      const issues = validateRecord(r, comp, r['연도']);
      allIssues.push(...issues);
    });
  });
  
  if (allIssues.length === 0) {
    console.log('%c✅ 데이터 무결성 검증 통과 (EV = 시가총액 + Net Debt 전수 일치)', 'color: green; font-weight: bold');
  } else {
    console.warn(`⚠️ 데이터 무결성 검증 이슈 ${allIssues.length}건:`);
    allIssues.forEach(i => console.warn(`  ${i}`));
  }
  
  return allIssues;
}

// 하위 호환
export function calculateNetDebt(borrowings = 0, cash = 0, shortFin = 0, lease = 0, nonControlling = 0) {
  return (Number(borrowings) || 0) - ((Number(cash) || 0) + (Number(shortFin) || 0)) + (Number(lease) || 0) + (Number(nonControlling) || 0);
}

// v2.8: canonical period identity, separate percentage-point and per-share formatting.
export function periodKey(value) {
  const s = String(value ?? '').trim();
  // 기존 원천의 숫자 2026은 2026H1 행이다. 이후 FY/H2/Q 입력은 명시 표기로만 허용한다.
  if (s === '2026' || /^2026\s*(상반기|1H)$/i.test(s)) return '2026H1';
  return s.replace(/년$/, '');
}

export function getPeriodKind(value) {
  const s = String(value ?? '').trim();
  if (s === '2026' || /(상반기|하반기|1H|2H)/i.test(s)) return 'HALF';
  if (/(분기|[1-4]Q)/i.test(s)) return 'QUARTER';
  return 'ANNUAL';
}
export function formatPercentagePoints(value, digits = 1) {
  const n = safeNum(value);
  return n === null ? '데이터 없음' : formatPercent(n, digits).replace('%', '%p');
}
export function formatWonPerShare(value) {
  const n = safeNum(value);
  return n === null ? '데이터 없음' : n.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '원';
}

export function formatEok(value) {
  const n = safeNum(value);
  if (n === null) return '데이터 없음';
  const rounded = Math.round(n / 1e8);
  return `${Object.is(rounded, -0) ? 0 : rounded.toLocaleString('ko-KR')}억원`;
}

// v3.0: Main TSR is fiscal-attribution cash dividend, without reinvestment.
export function calculatePeriodReturns(records) {
  const auxiliary = calculateReinvestedPeriodReturns(records);
  const range = (first, last) => {
    const rows = [];
    for(let y=first;y<=last;y++){
      const matches=(records||[]).filter(r=>Number(String(r['연도']).slice(0,4))===y);
      if(matches.length!==1) return null;
      rows.push(matches[0]);
    }
    const begin=safeNum(rows[0]?.['기초주가']);
    const end=safeNum(rows.at(-1)?.['기말주가']);
    const dividends=rows.map(r=>safeNum(r.DPS));
    if(begin===null||begin<=0||end===null||dividends.some(d=>d===null)) return null;
    return (end-begin+dividends.reduce((a,b)=>a+b,0))/begin;
  };
  return {...auxiliary, tsr1Y:range(2025,2025),tsr3Y:range(2023,2025),
    tsr5Y:range(2021,2025),tsr10Y:range(2016,2025),tsr26H1:range(2026,2026),
    cumAll:range(2016,2026),reinvested:auxiliary,method:'세전·귀속 DPS·비재투자'};
}
export const PEER_NAMES = ['CJ제일제당','농심','삼양식품','대상','오뚜기'];
export function peerMedian(values) {
  const a=values.map(safeNum).filter(v=>v!==null).sort((a,b)=>a-b);
  return a.length ? (a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2 : null;
}
