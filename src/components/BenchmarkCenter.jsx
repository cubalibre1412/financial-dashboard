import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { 
  TrendingUp, 
  Home, 
  Building, 
  LineChart, 
  Layers, 
  ShieldCheck, 
  Info 
} from 'lucide-react';
import { 
  formatPercent, 
  calculateReinvestedPeriodReturns, 
  safeNum 
} from '../utils/financialCalculators';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler
);



const wealthBaseLinePlugin = {
  id: 'wealthBaseLine',
  afterDraw(chart) {
    // Chart.js 전역 등록 플러그인이므로, ₩100 투자 기준 차트에서만 명시적으로 활성화한다.
    // 피어 EV·수익성·TSR 비교 차트에는 기준선이 의미 없으며 표시하면 안 된다.
    if (chart.options.plugins?.wealthBaseLine?.enabled !== true) return;
    const yScale = chart.scales.y;
    if (!yScale || 100 < yScale.min || 100 > yScale.max) return;
    const y = yScale.getPixelForValue(100);
    const { left, right } = chart.chartArea;
    const { ctx } = chart;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(71, 85, 105, 0.9)';
    ctx.font = '600 10px sans-serif';
    ctx.fillText('₩100', left + 4, y - 4);
    ctx.restore();
  }
};

ChartJS.register(wealthBaseLinePlugin);

function WealthIndexCard({ period, theme }) {
  const data = { labels: period.items.map(item => item.shortLabel), datasets: [{ data: period.items.map(item => item.wealth), backgroundColor: period.items.map(item => item.color), borderRadius: 5, maxBarThickness: 32 }] };
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      wealthBaseLine: { enabled: true },
      legend: { display: false },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
        titleColor: theme === 'dark' ? '#f8fafc' : '#0f172a', bodyColor: theme === 'dark' ? '#cbd5e1' : '#334155',
        borderColor: 'rgba(148, 163, 184, 0.35)', borderWidth: 1,
        callbacks: { label: context => { const item = period.items[context.dataIndex]; return ['기간말 가치: ₩' + item.wealth.toFixed(1), '누적 수익률: ' + formatPercent(item.returnValue)]; } }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme === 'dark' ? '#94a3b8' : '#64748b', font: { size: 10, weight: '600' } } },
      y: { suggestedMin: Math.min(70, ...period.items.map(item => item.wealth - 5)), suggestedMax: Math.max(110, ...period.items.map(item => item.wealth + 5)), grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)' }, ticks: { color: theme === 'dark' ? '#94a3b8' : '#64748b', callback: value => '₩' + value } }
    }
  };
  return (
    <article className="wealth-index-period-card">
      <div className="wealth-index-card-header"><div><strong>{period.label}</strong><span>{period.range}</span></div><span className="wealth-index-base">원금 ₩100</span></div>
      <div className="wealth-index-chart"><Bar data={data} options={options} /></div>
      <div className="wealth-index-values">{period.items.map(item => (
        <div className="wealth-index-row" key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><b>₩{item.wealth.toFixed(0)}</b><em className={item.returnValue >= 0 ? 'color-pos' : 'color-neg'}>{formatPercent(item.returnValue)}</em></div>
      ))}</div>
    </article>
  );
}

export default function BenchmarkCenter({ 
  benchmarkData, 
  pulmuoneRecords, 
  theme 
}) {
  const [aptTimeframe, setAptTimeframe] = useState('ALL'); // 'ALL' | 'RECENT_3Y' | 'RECENT_5Y'


  const krxRows = benchmarkData?.krx || [];
  const aptRows = benchmarkData?.apartment || benchmarkData?.consumerPriceIndex || [];

  // 지수별 헬퍼 (명시적 식별자 사용)
  const getIndexRow = (name, year) => 
    krxRows.find(r => r['지수명'] === name && String(r['연도']).startsWith(String(year)));

  const getIndexReturn = (name, startYear, endYear) => {
    const rStart = getIndexRow(name, startYear);
    const rEnd = getIndexRow(name, endYear);
    if (!rStart || !rEnd) return null;
    const b0 = safeNum(rStart['기초값']);
    const bEnd = safeNum(rEnd['기말값']);
    if (b0 && bEnd && b0 > 0) {
      return (bEnd - b0) / b0;
    }
    return null;
  };

  const getIndexAnnualReturn = (name, year) => {
    const r = getIndexRow(name, year);
    return safeNum(r?.['연간수익률']);
  };

  // 1. KOSPI TR
  const kospiRows = krxRows.filter(r => r['지수명'] === 'KOSPI');
  const latestKospi = kospiRows[kospiRows.length - 1] || {};
  const kospi10Y = getIndexReturn('KOSPI', 2016, 2025);
  const kospi5Y = getIndexReturn('KOSPI', 2021, 2025);
  const kospi3Y = getIndexReturn('KOSPI', 2023, 2025);
  const kospi1Y = getIndexAnnualReturn('KOSPI', 2025);
  const kospi26H1 = getIndexAnnualReturn('KOSPI', 2026);

  // 2. 코스피 200 생활소비재 TR (생활소비재를 음식료업종으로 표기하지 않음)
  const consumerRows = krxRows.filter(r => r['지수명'] === '코스피 200 생활소비재');
  const latestConsumer = consumerRows[consumerRows.length - 1] || {};
  const consumer10Y = getIndexReturn('코스피 200 생활소비재', 2016, 2025);
  const consumer5Y = getIndexReturn('코스피 200 생활소비재', 2021, 2025);
  const consumer3Y = getIndexReturn('코스피 200 생활소비재', 2023, 2025);
  const consumer1Y = getIndexAnnualReturn('코스피 200 생활소비재', 2025);
  const consumer26H1 = getIndexAnnualReturn('코스피 200 생활소비재', 2026);

  // 3. KRX 채권종합 TR 및 국채 TR (명시적 식별자)
  const bondRows = krxRows.filter(r => r['지수명'] === 'KRX 채권종합');
  const latestBond = bondRows[bondRows.length - 1] || {};
  const bond10Y = getIndexReturn('KRX 채권종합', 2016, 2025);
  const bond5Y = getIndexReturn('KRX 채권종합', 2021, 2025);
  const bond3Y = getIndexReturn('KRX 채권종합', 2023, 2025);
  const bond1Y = getIndexAnnualReturn('KRX 채권종합', 2025);
  const bond26H1 = getIndexAnnualReturn('KRX 채권종합', 2026);

  const govBond10Y = getIndexReturn('KRX 채권종합-국채', 2016, 2025);
  const govBond5Y = getIndexReturn('KRX 채권종합-국채', 2021, 2025);
  const govBond3Y = getIndexReturn('KRX 채권종합-국채', 2023, 2025);
  const govBond1Y = getIndexAnnualReturn('KRX 채권종합-국채', 2025);
  const govBond26H1 = getIndexAnnualReturn('KRX 채권종합-국채', 2026);

  // 4. 전국 아파트 매매가격지수(PR): 시장·대체투자 비교의 공식 기준
const apt10Y = getIndexReturn('전국 아파트', 2016, 2025);
  const apt5Y = getIndexReturn('전국 아파트', 2021, 2025);
  const apt3Y = getIndexReturn('전국 아파트', 2023, 2025);
  const apt1Y = getIndexAnnualReturn('전국 아파트', 2025);
  const apt26H1 = getIndexAnnualReturn('전국 아파트', 2026);

  // 5. 풀무원 TSR 계산
  const pulmuoneTSR = calculateReinvestedPeriodReturns(pulmuoneRecords);

  const createMarketPeriod = (label, range, values) => ({
    label,
    range,
    items: values.map(item => ({
      ...item,
      wealth: item.returnValue === null || item.returnValue === undefined ? null : 100 * (1 + item.returnValue)
    }))
  });

  // 시장·대체투자 비교는 풀무원 배당 재투자 TSR과 총수익지수(TR)를 동일한 ₩100 투자 기준으로 표시한다.
  // 아파트는 가격변동지수(PR)이며 임대수익·세금·거래비용은 반영하지 않는다.
  const marketComparisonPeriods = [
    createMarketPeriod('1Y', 'FY2024말 → FY2025말', [
      { label: '풀무원 TSR', shortLabel: '풀무원', returnValue: pulmuoneTSR.tsr1Y, color: '#10b981' },
      { label: 'KOSPI TR', shortLabel: 'KOSPI', returnValue: kospi1Y, color: '#2563eb' },
      { label: '생활소비재 TR', shortLabel: '생활소비재', returnValue: consumer1Y, color: '#5b84b1' },
      { label: '국채 TR', shortLabel: '국채', returnValue: govBond1Y, color: '#64748b' },
      { label: '전국 아파트 PR', shortLabel: '전국 아파트', returnValue: apt1Y, color: '#8b7438' }
    ]),
    createMarketPeriod('3Y', 'FY2022말 → FY2025말', [
      { label: '풀무원 TSR', shortLabel: '풀무원', returnValue: pulmuoneTSR.tsr3Y, color: '#10b981' },
      { label: 'KOSPI TR', shortLabel: 'KOSPI', returnValue: kospi3Y, color: '#2563eb' },
      { label: '생활소비재 TR', shortLabel: '생활소비재', returnValue: consumer3Y, color: '#5b84b1' },
      { label: '국채 TR', shortLabel: '국채', returnValue: govBond3Y, color: '#64748b' },
      { label: '전국 아파트 PR', shortLabel: '전국 아파트', returnValue: apt3Y, color: '#8b7438' }
    ]),
    createMarketPeriod('5Y', 'FY2020말 → FY2025말', [
      { label: '풀무원 TSR', shortLabel: '풀무원', returnValue: pulmuoneTSR.tsr5Y, color: '#10b981' },
      { label: 'KOSPI TR', shortLabel: 'KOSPI', returnValue: kospi5Y, color: '#2563eb' },
      { label: '생활소비재 TR', shortLabel: '생활소비재', returnValue: consumer5Y, color: '#5b84b1' },
      { label: '국채 TR', shortLabel: '국채', returnValue: govBond5Y, color: '#64748b' },
      { label: '전국 아파트 PR', shortLabel: '전국 아파트', returnValue: apt5Y, color: '#8b7438' }
    ]),
    createMarketPeriod('10Y', 'FY2015말 → FY2025말', [
      { label: '풀무원 TSR', shortLabel: '풀무원', returnValue: pulmuoneTSR.tsr10Y, color: '#10b981' },
      { label: 'KOSPI TR', shortLabel: 'KOSPI', returnValue: kospi10Y, color: '#2563eb' },
      { label: '생활소비재 TR', shortLabel: '생활소비재', returnValue: consumer10Y, color: '#5b84b1' },
      { label: '국채 TR', shortLabel: '국채', returnValue: govBond10Y, color: '#64748b' },
      { label: '전국 아파트 PR', shortLabel: '전국 아파트', returnValue: apt10Y, color: '#8b7438' }
    ])
  ];

  // Monthly Apartment Trend Chart Data (한국부동산원 유효 128개 관측치 시계열 정렬)
  const parseYm = (str) => {
    const m = String(str || '').match(/(\d{4})년\s*(\d{1,2})월/);
    return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
  };
  const sortedApt = [...aptRows].sort((a, b) => parseYm(a['자료시점']) - parseYm(b['자료시점']));

  let filteredApt = sortedApt;
  if (aptTimeframe === 'RECENT_3Y') {
    filteredApt = sortedApt.slice(-36);
  } else if (aptTimeframe === 'RECENT_5Y') {
    filteredApt = sortedApt.slice(-60);
  }

  const aptChartData = {
    labels: filteredApt.map(r => r['자료시점']),
    datasets: [
      {
        label: '서울 아파트 매매지수',
        data: filteredApt.map(r => Number(r['서울'])),
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.08)',
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.2
      },
      {
        label: '전국 아파트 매매지수',
        data: filteredApt.map(r => Number(r['전국'])),
        borderColor: '#94a3b8',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [4, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2
      }
    ]
  };

  const aptChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: theme === 'dark' ? '#cbd5e1' : '#475569',
          boxWidth: 12,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
        bodyColor: theme === 'dark' ? '#cbd5e1' : '#334155',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 10
      }
    },
    scales: {
      x: {
        grid: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          maxRotation: 45
        }
      },
      y: {
        grid: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b'
        }
      }
    }
  };

  return (
    <div className="benchmark-center-container">
      {/* Top Banner */}
      <div className="benchmark-banner glass-card">
        <div className="brand-section">
          <div className="brand-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8' }}>
            <LineChart size={24} className="accent-blue" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">비교 지수 & 벤치마크 인텔리전스 센터</h2>
            <p className="text-secondary text-sm">
              KRX 시장/업종 총수익지수(TR), 채권지수(TR), 아파트 실거래가격지수(PR) 및 상대 성과 전수 대조
            </p>
          </div>
        </div>
      </div>

      {/* 안내 박스: PR vs TR 및 원천 지수 안내 */}
      <div className="notice-card glass-card p-3 mb-3 text-xs text-secondary flex items-start gap-2">
        <Info size={16} className="accent-blue flex-shrink-0 mt-0.5" />
        <div>
          <span>
            <strong>지수 구분 및 산식 기준 안내:</strong> 
            KOSPI, 코스피 200 생활소비재, KRX 채권종합은 <strong>배당·이자 재투자가 포함된 총수익지수(TR)</strong>이며, 이 화면의 풀무원 수익률도 재투자 기준입니다. 
            아파트 매매가격지수는 임대소득이 제외된 <strong>순수 가격변동률(PR)</strong>입니다. 
            화면에는 원천 데이터에 포함된 지수만 표시합니다.
          </span>
        </div>
      </div>

      {/* Benchmark KPI Cards */}
      <div className="kpi-grid">
        {/* 1. KOSPI TR */}
        <div className="kpi-card glass-card">
          <div className="kpi-header">
            <span className="kpi-title">KOSPI TR (시장 총수익)</span>
            <div className="kpi-icon-badge accent-blue">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className={`kpi-main-val tabular-nums ${Number(latestKospi['연간수익률']) >= 0 ? 'color-pos' : 'color-neg'}`}>
              {formatPercent(latestKospi['연간수익률'])}
            </span>
            <span className="kpi-period-tag">'26 상반기 (06.30)</span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub-label">최근 1년('25) / 3년('23~'25):</span>
            <span className="tabular-nums font-semibold text-primary">
              {formatPercent(kospi1Y)} / {formatPercent(kospi3Y)}
            </span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub-label">10개년 ('16~'25년) 누적:</span>
            <span className="tabular-nums font-bold color-pos">
              {formatPercent(kospi10Y)}
            </span>
          </div>
        </div>

        {/* 2. 코스피 200 생활소비재 TR */}
        <div className="kpi-card glass-card">
          <div className="kpi-header">
            <span className="kpi-title">코스피 200 생활소비재 TR</span>
            <div className="kpi-icon-badge accent-amber">
              <Building size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className={`kpi-main-val tabular-nums ${Number(latestConsumer['연간수익률']) >= 0 ? 'color-pos' : 'color-neg'}`}>
              {formatPercent(latestConsumer['연간수익률'])}
            </span>
            <span className="kpi-period-tag">'26 상반기 (06.30)</span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub-label">최근 1년('25) / 3년('23~'25):</span>
            <span className="tabular-nums font-semibold text-primary">
              {formatPercent(consumer1Y)} / {formatPercent(consumer3Y)}
            </span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub-label">10개년 ('16~'25년) 누적:</span>
            <span className={`tabular-nums font-bold ${consumer10Y !== null && consumer10Y >= 0 ? 'color-pos' : 'color-neg'}`}>
              {formatPercent(consumer10Y)}
            </span>
          </div>
        </div>

        {/* 3. KRX 채권종합 TR */}
        <div className="kpi-card glass-card">
          <div className="kpi-header">
            <span className="kpi-title">KRX 채권종합 TR</span>
            <div className="kpi-icon-badge accent-purple">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className={`kpi-main-val tabular-nums ${Number(latestBond['연간수익률']) >= 0 ? 'color-pos' : 'color-neg'}`}>
              {formatPercent(latestBond['연간수익률'])}
            </span>
            <span className="kpi-period-tag">'26 상반기 (06.30)</span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub-label">최근 1년('25) / 3년('23~'25):</span>
            <span className="tabular-nums font-semibold text-primary">
              {formatPercent(bond1Y)} / {formatPercent(bond3Y)}
            </span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub-label">10개년 ('16~'25년) 누적:</span>
            <span className="tabular-nums font-bold color-pos">
              {formatPercent(bond10Y)}
            </span>
          </div>
        </div>

        {/* 4. 전국 아파트 매매가격지수(PR) */}
        <div className="kpi-card glass-card">
          <div className="kpi-header">
            <span className="kpi-title">전국 아파트 매매가격지수(PR)</span>
            <div className="kpi-icon-badge" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
              <Home size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-main-val tabular-nums color-pos">
              {formatPercent(apt26H1)}
            </span>
            <span className="kpi-period-tag">'26 상반기 (06.30)</span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub-label">최근 1년('25) / 3년('23~'25):</span>
            <span className="tabular-nums font-semibold text-primary">
              {formatPercent(apt1Y)} / {formatPercent(apt3Y)}
            </span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub-label">10개년 ('16~'25년) 누적:</span>
            <span className="tabular-nums font-bold color-pos">
              {formatPercent(apt10Y)}
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column Charts */}
      <div className="charts-two-col">
        {/* 1. ₩100 Wealth Index Comparison */}
        <div className="wealth-comparison-card chart-card glass-card">
          <div className="chart-header">
            <div className="chart-title-row">
              <LineChart className="accent-blue" size={20} />
              <h3 className="chart-title">시장·대체투자 비교: ₩100 기준 기간말 가치</h3>
            </div>
            <p className="chart-desc">
              풀무원은 <strong>배당 재투자 TSR</strong>, KOSPI·생활소비재·국채는 <strong>총수익지수(TR)</strong>, 아파트는 <strong>전국 매매가격지수(PR)</strong>를 적용했습니다.
            </p>
          </div>
          <div className="wealth-index-grid">
            {marketComparisonPeriods.map(period => <WealthIndexCard key={period.label} period={period} theme={theme} />)}
          </div>
          <p className="wealth-index-note">
            아파트 PR은 가격변동만 반영하며 임대수익·세금·거래비용은 포함하지 않습니다. 2026년 상반기 수익률은 상단 KPI와 연도별 표에서 별도 확인합니다.
          </p>
        </div>

        {/* 2. Monthly Apartment Price Index Chart */}
        <div className="benchmark-apartment-card chart-card glass-card">
          <div className="chart-header">
            <div className="header-top-row" style={{ width: '100%' }}>
              <div className="chart-title-row">
                <Home size={20} style={{ color: '#ec4899' }} />
                <h3 className="chart-title">한국부동산원 아파트 매매가격지수 월별 추이 ({aptRows.length}개 관측치)</h3>
              </div>
              <div className="segmented-control" style={{ maxWidth: 220 }}>
                <button 
                  className={`seg-btn ${aptTimeframe === 'ALL' ? 'active' : ''}`}
                  onClick={() => setAptTimeframe('ALL')}
                >
                  전체(2015~)
                </button>
                <button 
                  className={`seg-btn ${aptTimeframe === 'RECENT_5Y' ? 'active' : ''}`}
                  onClick={() => setAptTimeframe('RECENT_5Y')}
                >
                  최근 5년
                </button>
                <button 
                  className={`seg-btn ${aptTimeframe === 'RECENT_3Y' ? 'active' : ''}`}
                  onClick={() => setAptTimeframe('RECENT_3Y')}
                >
                  최근 3년
                </button>
              </div>
            </div>
            <p className="chart-desc">
              2015년 12월부터 원천 데이터 최종 시점까지 서울과 전국의 아파트 매매가격지수 시계열 추이 (한국부동산원)
            </p>
          </div>
          <div className="chart-body-wrapper" style={{ height: 340 }}>
            <Line data={aptChartData} options={aptChartOptions} />
          </div>
        </div>
      </div>

      {/* Year-by-Year Benchmark & Pulmuone Table */}
      <div className="table-card glass-card">
        <div className="table-header-box">
          <div className="chart-title-row">
            <Layers className="accent-blue" size={20} />
            <h3 className="chart-title">연도별 벤치마크 지표 & 풀무원 TSR 비교 데이터 시트</h3>
          </div>
          <p className="chart-desc">
            엑셀 원본 파일(`비교 지수 데이터.xlsx` 및 `풀무원_TSR_Valuation_2016_2026.xlsx`)의 연도별 실데이터 전수 대조표. 2026년은 2026년 6월 30일 기준 상반기 데이터입니다.
          </p>
        </div>

        <div className="table-responsive">
          <table className="peer-matrix-table">
            <thead>
              <tr>
                <th>구분 (연도)</th>
                <th className="text-right">풀무원 TSR</th>
                <th className="text-right">KOSPI TR</th>
                <th className="text-right">시장대비 Alpha</th>
                <th className="text-right">코스피 200 생활소비재 TR</th>
                <th className="text-right">KRX 채권종합 TR</th>
                <th className="text-right">전국 아파트 변동률(PR)</th>
                <th className="text-right">서울 아파트 변동률(참고)</th>
              </tr>
            </thead>
            <tbody>
              {['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'].map((yr) => {
                const is2026 = yr === '2026';
                const pRec = (pulmuoneRecords || []).find(r => String(r['연도']).includes(yr));
                const kRec = kospiRows.find(r => String(r['연도']) === yr);
                const cRec = consumerRows.find(r => String(r['연도']) === yr);
                const bRec = bondRows.find(r => String(r['연도']) === yr);
                const seoulAptRet = getIndexAnnualReturn('서울 아파트', yr);
                const natAptRet = getIndexAnnualReturn('전국 아파트', yr);

                const pTSR = pRec ? safeNum(pRec['연간 TSR']) : null;
                const kTSR = kRec ? safeNum(kRec['연간수익률']) : null;
                const cTSR = cRec ? safeNum(cRec['연간수익률']) : null;
                const bTSR = bRec ? safeNum(bRec['연간수익률']) : null;
                const alpha = (pTSR !== null && kTSR !== null) ? pTSR - kTSR : null;

                return (
                  <tr key={yr} className="matrix-row">
                    <td className="font-semibold text-xs">
                      {is2026 ? '2026 상반기 (06.30)' : `${yr}년`}
                    </td>
                    <td className={`text-right tabular-nums font-bold ${pTSR !== null ? (pTSR >= 0 ? 'color-pos' : 'color-neg') : ''}`}>
                      {pTSR !== null ? formatPercent(pTSR) : '-'}
                    </td>
                    <td className={`text-right tabular-nums ${kTSR !== null ? (kTSR >= 0 ? 'color-pos' : 'color-neg') : ''}`}>
                      {kTSR !== null ? formatPercent(kTSR) : '-'}
                    </td>
                    <td className={`text-right tabular-nums font-semibold ${alpha !== null ? (alpha >= 0 ? 'color-pos' : 'color-neg') : ''}`}>
                      {alpha !== null ? (alpha >= 0 ? `+${(alpha * 100).toFixed(1)}%p` : `${(alpha * 100).toFixed(1)}%p`) : '-'}
                    </td>
                    <td className={`text-right tabular-nums ${cTSR !== null ? (cTSR >= 0 ? 'color-pos' : 'color-neg') : ''}`}>
                      {cTSR !== null ? formatPercent(cTSR) : '-'}
                    </td>
                    <td className={`text-right tabular-nums ${bTSR !== null ? (bTSR >= 0 ? 'color-pos' : 'color-neg') : ''}`}>
                      {bTSR !== null ? formatPercent(bTSR) : '-'}
                    </td>
                    <td className="text-right tabular-nums text-primary font-medium">
                      {natAptRet !== null ? (
                        <span className={natAptRet >= 0 ? 'color-pos' : 'color-neg'}>
                          {formatPercent(natAptRet)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="text-right tabular-nums text-muted">
                      {seoulAptRet !== null ? (
                        <span className={seoulAptRet >= 0 ? 'color-pos' : 'color-neg'}>
                          {formatPercent(seoulAptRet)}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



