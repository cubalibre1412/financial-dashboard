import InfoTooltip from './InfoTooltip';
import usePrintDetails from '../utils/usePrintDetails';
import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { 
  TrendingUp, Info, Activity, Layers, 
  ChevronDown, ChevronUp, Award, BarChart2 
} from 'lucide-react';
import { formatPercent, safeNum, formatMultiple, formatKRW, periodKey, formatPercentagePoints } from '../utils/financialCalculators';

const METRIC_CONFIG = {
  netBorrowingToEbitda: {
    label: '순차입금/EBITDA',
    key: '순차입금/EBITDA (2026H1: TTM)',
    unit: '배',
    isMultiple: true,
    desc: '순차입금 ÷ EBITDA (2026H1은 TTM EBITDA 기준). 차입 부담을 설명하는 핵심 건전성 지표.',
    ttmLabel: '2026H1 (TTM)',
    format: (v) => {
      if (v === null || isNaN(v)) return '—';
      const num = Number(v);
      return `${num.toFixed(1)}배${num < 0 ? ' (순현금)' : ''}`;
    }
  },
  ebitdaGrowth: {
    label: 'EBITDA 증감률',
    key: 'EBITDA 증감률 (2026H1: TTM vs FY2025)',
    unit: '%',
    isPercent: true,
    desc: '당기 EBITDA ÷ 전기 EBITDA − 1 (2026H1은 TTM EBITDA ÷ FY2025 EBITDA − 1, 2016년은 전년 비교 불가).',
    ttmLabel: '2026H1 (TTM vs FY2025)',
    format: (v, year) => {
      if (String(year).startsWith('2016')) return '—';
      if (v === null || isNaN(v)) return '—';
      return formatPercent(v);
    }
  },
  priceReturn: {
    label: '주가수익률 (가격 기준)',
    key: '주가수익률(가격 기준)',
    unit: '%',
    isPercent: true,
    desc: '기말주가 ÷ 기초주가 − 1 (배당을 제외한 순수 주가 가격 변동률).',
    ttmLabel: '2026 상반기 단일 기간',
    format: (v) => v !== null && !isNaN(v) ? formatPercent(v) : '—'
  },
  dpsEffect: {
    label: 'DPS 기반 TSR 보정 효과',
    key: 'DPS 기반 TSR 보정 효과',
    unit: '%p',
    isPercent: true,
    desc: '연간 TSR − 주가수익률. 결산 귀속 DPS를 단순 가산한 비재투자 기준의 배당 기여도(%p).',
    ttmLabel: '2026 상반기 단일 기간',
    format: (v) => v !== null && !isNaN(v) ? formatPercentagePoints(v) : '—'
  }
};

export default function ManagementTrendsChart({ 
  companyName, 
  records, 
  allCompaniesData,
  theme 
}) {
  const printing = usePrintDetails();

  const [selectedMetric, setSelectedMetric] = useState('netBorrowingToEbitda');
  const [isPeerTableOpen, setIsPeerTableOpen] = useState(false);
  const cfg = METRIC_CONFIG[selectedMetric];

  // X축 라벨 구성 (2016 ~ 2026H1)
  const labels = records.map(r => {
    const y = String(r['연도']);
    return y.includes('2026') ? cfg.ttmLabel : `${y}년`;
  });

  // 선택 기업 시계열 데이터
  const companyValues = records.map(r => {
    const y = String(r['연도']);
    if (selectedMetric === 'ebitdaGrowth' && y.startsWith('2016')) {
      return null; // 2016년 EBITDA 증감률은 전년 비교 불가
    }
    return safeNum(r[cfg.key]);
  });

  const latestVal = companyValues[companyValues.length - 1];
  const latestYear = records[records.length - 1]['연도'];

  // 최신 시점 (2026H1) 피어 6개사 분포 산출
  const peerList = Object.keys(allCompaniesData || {});
  const peerDistribution = peerList.map(name => {
    const pRecs = allCompaniesData[name] || [];
    const pLatest = pRecs.find(r => periodKey(r['연도']) === periodKey(latestYear));
    const val = safeNum(pLatest?.[cfg.key]);
    return { name, val, isSelf: name === companyName };
  });

  const validPeerVals = peerDistribution.filter(d => d.name !== companyName).map(d => d.val).filter(v => v !== null && !isNaN(v));
  validPeerVals.sort((a, b) => a - b);

  const getMedian = (arr) => {
    if (!arr.length) return null;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const peerMedian = getMedian(validPeerVals);
  const peerLabel = `${companyName} 제외 5사`;
  const peerMin = validPeerVals.length ? validPeerVals[0] : null;
  const peerMax = validPeerVals.length ? validPeerVals[validPeerVals.length - 1] : null;

  // 좌측 시계열 Chart.js 데이터
  const isDark = theme === 'dark';
  const pointBgColors = records.map(r => String(r['연도']).includes('2026') ? '#f59e0b' : '#0284c7');
  const pointRadii = records.map(r => String(r['연도']).includes('2026') ? 7 : 4);

  const chartData = {
    labels,
    datasets: [
      {
        label: `${companyName} (${cfg.label})`,
        data: companyValues,
        borderColor: '#0284c7',
        backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.08)',
        borderWidth: 2.5,
        pointBackgroundColor: pointBgColors,
        pointBorderColor: isDark ? '#0f172a' : '#ffffff',
        pointBorderWidth: 1.5,
        pointRadius: pointRadii,
        tension: 0.2,
        fill: true
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const raw = context.raw;
            if (raw === null || raw === undefined) return '전년 비교 불가 (—)';
            return `${cfg.label}: ${cfg.format(raw, records[context.dataIndex]['연도'])}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: { size: 10 },
          color: isDark ? '#94a3b8' : '#64748b'
        }
      },
      y: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
        },
        ticks: {
          font: { size: 10 },
          color: isDark ? '#94a3b8' : '#64748b',
          callback: (value) => {
            if (cfg.isPercent) return `${(value * 100).toFixed(1)}${cfg.unit}`;
            if (cfg.isMultiple) return `${value.toFixed(1)}배`;
            return value;
          }
        }
      }
    }
  };

  // 피어 분포 내 상대적 위치 계산 (0% ~ 100%)
  // 게이지 축은 선택 기업이 아니라 피어 분포 자체의 최솟값·최댓값으로 고정한다.
  const minRange = peerMin ?? 0;
  const maxRange = peerMax ?? 1;
  const rangeSpan = Math.max(maxRange - minRange, 0.0001);
  const companyPosPct = latestVal !== null ? Math.max(0, Math.min(100, ((latestVal - minRange) / rangeSpan) * 100)) : 50;
  const medianPosPct = peerMedian !== null ? Math.max(0, Math.min(100, ((peerMedian - minRange) / rangeSpan) * 100)) : 50;
  const isOutsidePeerRange = latestVal !== null && peerMin !== null && peerMax !== null && (latestVal < peerMin || latestVal > peerMax);

  return (
    <div className="briefing-section glass-card p-4 mb-4" data-testid="management-trends-section">
      {/* 1. 상단: 지표 전환 버튼 + 설명 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-glass">
        <div className="flex items-center gap-2">
          <div className="kpi-icon-badge accent-emerald">
            <Activity size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-base text-primary">관리지표 시계열 추이 및 피어 위치</h4>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-800 text-sky-400 border border-slate-700">
                2016 ~ 2026H1 전체 시계열
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              {cfg.desc}
            </p>
          </div>
        </div>

        {/* 4대 지표 전환 버튼 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.keys(METRIC_CONFIG).map(k => (
            <button
              key={k}
              onClick={() => setSelectedMetric(k)}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                selectedMetric === k 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-card-subtle text-secondary hover:text-primary border border-glass'
              }`}
            >
              {METRIC_CONFIG[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 차트 구조 완벽 분리: 좌측(선택 기업 시계열) vs 우측(최신 피어 분포/위치) */}
      <div className="trends-split-layout">
        {/* 좌측 (2/3): 선택 기업 10개년 시계열 추이 */}
        <div className="p-3.5 bg-card-subtle rounded-lg border border-glass flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
              <TrendingUp size={14} className="accent-blue" />
              {companyName} {cfg.label} 2016–2026H1 추이
            </span>
            <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
              2026H1 별도 강조 구간
            </span>
          </div>

          <div className="h-64 w-full relative">
            <Line data={chartData} options={chartOptions} />
          </div>

          <div className="flex justify-between items-center text-[10px] text-muted pt-2 border-t border-slate-700/40 mt-2">
            <span>* 2026H1은 {cfg.ttmLabel} 산출 기준입니다.</span>
            {selectedMetric === 'ebitdaGrowth' && <span>* 2016년은 전년도 비교 데이터 미존재로 산출 제외(—)</span>}
          </div>
        </div>

        {/* 우측 (1/3): 최신 피어 분포 및 피어 위치 독립 카드 */}
        <div className="p-3.5 bg-card-subtle rounded-lg border border-glass flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Award size={14} className="accent-amber" />
                최신 피어 분포 ({latestYear})
              </span>
              <span className="text-[10px] text-muted">{peerLabel}</span>
            </div>

            {/* 최신 지표 비교 카드 3종 */}
            <div className="space-y-2 mb-4">
              <div className="p-2.5 rounded bg-card border border-glass">
                <div className="text-[11px] text-muted flex justify-between">
                  <span>{companyName} (최신)</span>
                  <span className="font-semibold text-sky-400">선택 기업</span>
                </div>
                <div className="text-lg font-black text-primary tabular-nums mt-0.5">
                  {cfg.format(latestVal, latestYear)}
                </div>
              </div>

              <div className="p-2.5 rounded bg-card border border-glass">
                <div className="text-[11px] text-muted flex justify-between">
                  <span>{peerLabel} 중앙값</span>
                  <span className="text-[10px] text-secondary">중위 기준</span>
                </div>
                <div className="text-lg font-black text-amber-400 tabular-nums mt-0.5">
                  {cfg.format(peerMedian, latestYear)}
                </div>
              </div>

              <div className="p-2 rounded bg-card border border-glass text-xs">
                <div className="text-[11px] text-muted mb-1">피어 최솟값 ~ 최댓값 범위</div>
                <div className="text-xs font-bold font-mono text-secondary flex justify-between">
                  <span>최저: {cfg.format(peerMin, latestYear)}</span>
                  <span>최고: {cfg.format(peerMax, latestYear)}</span>
                </div>
              </div>
            </div>

            {/* 상대적 위치 시각화 게이지 */}
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-secondary mb-1 flex justify-between">
                <span>피어 내 상대적 위치</span>
                <span className="text-sky-400 font-mono text-[10px]">{latestVal === null ? '비교 불가' : isOutsidePeerRange ? '피어 범위 밖' : `${companyPosPct.toFixed(0)}% 위치`}</span>
              </div>
              <div className="relative h-3 bg-slate-800 rounded-full overflow-visible border border-slate-700">
                {/* 5사 중앙값 마커 */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-amber-400 z-10"
                  style={{ left: `${medianPosPct}%` }}
                  title={`${peerLabel} 중앙값: ${cfg.format(peerMedian, latestYear)}`}
                />
                {/* 회사 위치 마커 */}
                <div 
                  className="absolute -top-1 w-5 h-5 rounded-full bg-sky-500 border-2 border-white shadow-md z-20 flex items-center justify-center -ml-2.5"
                  style={{ left: `${companyPosPct}%` }}
                  title={`${companyName}: ${cfg.format(latestVal, latestYear)}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                </div>
              </div>
              <div className="flex justify-between text-[9px] text-muted font-mono mt-1">
                <span>최솟값 (Min)</span>
                <span className="text-amber-400">중앙값</span>
                <span>최댓값 (Max)</span>
              </div>
            </div>
          </div>

          <div className="briefing-method-note mt-3">
            <span>피어 비교 기준</span>
            <InfoTooltip label="피어 비교 기준 상세" text={`좌측은 선택 기업의 시계열, 우측은 최신 시점 ${peerLabel} 분포입니다. 두 영역은 서로 다른 축과 목적이므로 분리해 표시합니다.`} />
          </div>
        </div>
      </div>

      {/* 3. 보조 표: 상세 피어 표 (기본 접힘 상태) */}
      <div className="glass-card rounded-lg border border-glass mb-3 overflow-hidden">
        <button
          onClick={() => setIsPeerTableOpen(!isPeerTableOpen)}
          className="w-full p-3 flex items-center justify-between text-xs font-bold text-primary hover:bg-white/5 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <BarChart2 size={14} className="accent-blue" />
            최신 {latestYear} 6개사 {cfg.label} 세부 비교표 ({isPeerTableOpen ? '접기' : '펼쳐보기'})
          </span>
          {isPeerTableOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {(isPeerTableOpen || printing) && (
          <div className="p-3 pt-0 border-t border-glass">
            <table className="w-full text-xs text-left border-collapse mt-2">
              <thead>
                <tr className="border-b border-glass text-muted bg-card-subtle">
                  <th className="py-2 px-2.5 font-semibold">기업명</th>
                  <th className="py-2 px-2.5 font-semibold text-right">{cfg.label}</th>
                  <th className="py-2 px-2.5 font-semibold text-right">5사 중앙값 대비</th>
                  <th className="py-2 px-2.5 font-semibold">비고</th>
                </tr>
              </thead>
              <tbody>
                {peerDistribution.map(p => {
                  const diff = (p.val !== null && peerMedian !== null) ? (p.val - peerMedian) : null;
                  return (
                    <tr 
                      key={p.name}
                      className={`border-b border-glass/40 ${p.isSelf ? 'bg-blue-500/10 font-bold text-primary' : 'hover:bg-white/5'}`}
                    >
                      <td className="py-2 px-2.5 flex items-center gap-1.5">
                        {p.name}
                        {p.isSelf && <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/20 text-blue-400">선택</span>}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold tabular-nums">
                        {cfg.format(p.val, latestYear)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-muted tabular-nums">
                        {diff !== null ? (cfg.isMultiple ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}배` : formatPercentagePoints(diff)) : '—'}
                      </td>
                      <td className="py-2 px-2.5 text-[11px] text-muted">
                        {p.val !== null && p.val < 0 && selectedMetric === 'netBorrowingToEbitda' ? '순현금 기업' : '정상 산출'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="briefing-method-note">
        <span>관리지표 산정 기준</span>
        <InfoTooltip label="관리지표 산정 기준 상세" text="2026 상반기는 주가수익률·DPS 보정 효과는 반기 단일 기준, 순차입금/EBITDA·EBITDA 증감률은 최근 4개 분기 합산 TTM 기준입니다. 순차입금/EBITDA가 음수이면 순현금 상태를 의미합니다." />
      </div>
    </div>
  );
}
