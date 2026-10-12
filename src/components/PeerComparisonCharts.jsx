import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { BarChart3, Layers, TrendingUp, DollarSign, Percent, Sparkles, Scale } from 'lucide-react';
import { formatKRW, formatPercent, formatMultiple, getNetDebtBroad, getMarketCap, calculatePeriodReturns, peerMedian } from '../utils/financialCalculators';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend
);

const COMPANY_COLORS = {
  "풀무원": { primary: "#10b981", light: "rgba(16, 185, 129, 0.2)", border: "#059669" },
  "CJ제일제당": { primary: "#38bdf8", light: "rgba(56, 189, 248, 0.2)", border: "#0284c7" },
  "농심": { primary: "#f59e0b", light: "rgba(245, 158, 11, 0.2)", border: "#d97706" },
  "삼양식품": { primary: "#ec4899", light: "rgba(236, 72, 153, 0.2)", border: "#db2777" },
  "대상": { primary: "#a855f7", light: "rgba(168, 85, 247, 0.2)", border: "#9333ea" },
  "오뚜기": { primary: "#f43f5e", light: "rgba(244, 63, 94, 0.2)", border: "#e11d48" }
};

export default function PeerComparisonCharts({ 
  allCompaniesData, 
  theme = 'dark',
  onSelectCompany 
}) {
  const [activeMetricTab, setActiveMetricTab] = useState('ev_ebitda'); // 'ev_ebitda' | 'profit' | 'cum_tsr' | 'pbr_roe'

  const companies = Object.keys(allCompaniesData);

  // Extract latest metrics for all 6 companies
  const companyMetrics = companies.map(name => {
    const records = allCompaniesData[name] || [];
    const latest = records[records.length - 1] || {};

    // 10Y TSR (2016~2025) 기준 사용
    const periodReturns = calculatePeriodReturns(records);
    const cumTSR = periodReturns.tsr10Y ?? 0;

    const mcap = getMarketCap(latest) ?? 0;
    const netDebt = getNetDebtBroad(latest) ?? 0;
    const ev = Number(latest['EV(원)']) || 0;
    const ebit = Number(latest['EBIT(원)']) || 0;
    const ebitda = Number(latest['EBITDA(원)']) || 0;
    const evEbitda = Number(latest['EV/EBITDA']) || 0;
    const pbr = Number(latest['PBR']) || 0;
    const roe = Number(latest['ROE']) || 0;
    const tsr = Number(latest['연간 TSR']) || 0;

    return {
      name,
      mcap,
      netDebt,
      ev,
      ebit,
      ebitda,
      evEbitda,
      pbr,
      roe,
      tsr,
      cumTSR
    };
  });

  // Calculate peer average EV/EBITDA
  const validEvEbitda = companyMetrics.filter(m => m.name !== '풀무원' && m.evEbitda > 0);
  const avgEvEbitda = validEvEbitda.length > 0 
    ? peerMedian(validEvEbitda.map(m=>m.evEbitda)) 
    : 0;

  // Chart 1: Enterprise Value Structure (Stacked Bar: Mcap + Net Debt = EV)
  const evChartData = {
    labels: companyMetrics.map(m => m.name),
    datasets: [
      {
        label: '시가총액 (Market Cap)',
        data: companyMetrics.map(m => Math.round(m.mcap / 100000000)), // 억원 단위
        backgroundColor: companyMetrics.map(m => 
          m.name === '풀무원' ? '#10b981' : (theme === 'dark' ? '#38bdf8' : '#0284c7')
        ),
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
        stack: 'ev'
      },
      {
        label: 'Net Debt',
        data: companyMetrics.map(m => Math.round(m.netDebt / 100000000)), // 억원 단위
        backgroundColor: companyMetrics.map(m => 
          m.name === '풀무원' ? 'rgba(16, 185, 129, 0.35)' : (theme === 'dark' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.35)')
        ),
        borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
        stack: 'ev'
      }
    ]
  };

  const evChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
        padding: 10,
        callbacks: {
          label: function(context) {
            const val = context.raw;
            return `${context.dataset.label}: ${val.toLocaleString()}억원`;
          },
          afterBody: function(items) {
            const idx = items[0].dataIndex;
            const company = companyMetrics[idx];
            return `기업가치(EV): ${Math.round(company.ev / 100000000).toLocaleString()}억원`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          font: { weight: 'bold' }
        }
      },
      y: {
        stacked: true,
        grid: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          callback: (val) => `${(val / 10000).toFixed(0)}조원`
        }
      }
    }
  };

  // Chart 2: Dynamic Multi-Metric Bar Chart
  const getMetricChartData = () => {
    const labels = companyMetrics.map(m => m.name);

    if (activeMetricTab === 'ev_ebitda') {
      return {
        labels,
        datasets: [
          {
            label: 'EV / EBITDA 배수',
            data: companyMetrics.map(m => m.evEbitda),
            backgroundColor: companyMetrics.map(m => 
              m.name === '풀무원' ? '#10b981' : 'rgba(168, 85, 247, 0.85)'
            ),
            borderColor: companyMetrics.map(m => 
              m.name === '풀무원' ? '#059669' : '#9333ea'
            ),
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      };
    }

    if (activeMetricTab === 'profit') {
      return {
        labels,
        datasets: [
          {
            label: '영업이익 (EBIT)',
            data: companyMetrics.map(m => Math.round(m.ebit / 100000000)),
            backgroundColor: companyMetrics.map(m => 
              m.name === '풀무원' ? '#10b981' : (theme === 'dark' ? '#38bdf8' : '#0284c7')
            ),
            borderRadius: 4
          },
          {
            label: 'EBITDA (현금창출력)',
            data: companyMetrics.map(m => Math.round(m.ebitda / 100000000)),
            backgroundColor: companyMetrics.map(m => 
              m.name === '풀무원' ? 'rgba(16, 185, 129, 0.4)' : (theme === 'dark' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(2, 132, 199, 0.4)')
            ),
            borderRadius: 4
          }
        ]
      };
    }

    if (activeMetricTab === 'cum_tsr') {
      const tsrData = companyMetrics.map(m => Math.round(m.cumTSR * 1000) / 10);
      const labelText = "10개년 ('16~'25) 누적 TSR (비재투자)";

      return {
        labels,
        datasets: [
          {
            label: labelText,
            data: tsrData,
            backgroundColor: companyMetrics.map((m, idx) => {
              const val = tsrData[idx];
              if (m.name === '풀무원') return '#10b981';
              return val >= 0 ? '#38bdf8' : '#f43f5e';
            }),
            borderRadius: 6
          }
        ]
      };
    }

    if (activeMetricTab === 'pbr_roe') {
      return {
        labels,
        datasets: [
          {
            label: 'ROE (%)',
            data: companyMetrics.map(m => Math.round(m.roe * 1000) / 10),
            backgroundColor: companyMetrics.map(m => 
              m.name === '풀무원' ? '#10b981' : '#f59e0b'
            ),
            borderRadius: 4
          },
          {
            label: 'PBR (배)',
            data: companyMetrics.map(m => m.pbr),
            backgroundColor: 'rgba(236, 72, 153, 0.7)',
            borderRadius: 4
          }
        ]
      };
    }

    return { labels, datasets: [] };
  };

  const metricChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
        padding: 10,
        callbacks: {
          label: function(context) {
            const val = context.raw;
            if (activeMetricTab === 'ev_ebitda') return `EV/EBITDA: ${val.toFixed(1)}배 (5사 중앙값: ${avgEvEbitda.toFixed(1)}배)`;
            if (activeMetricTab === 'profit') return `${context.dataset.label}: ${val.toLocaleString()}억원`;
            if (activeMetricTab === 'cum_tsr') return `10개년('16~'25) 누적 TSR: ${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
            if (activeMetricTab === 'pbr_roe') {
              return context.dataset.label.includes('ROE') ? `ROE: ${val.toFixed(1)}%` : `PBR: ${val.toFixed(2)}배`;
            }
            return `${val}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          font: { weight: 'bold' }
        }
      },
      y: {
        grid: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          callback: (val) => {
            if (activeMetricTab === 'ev_ebitda') return `${val}배`;
            if (activeMetricTab === 'profit') return `${val.toLocaleString()}억`;
            if (activeMetricTab === 'cum_tsr') return `${val}%`;
            if (activeMetricTab === 'pbr_roe') return `${val}`;
            return `${val}`;
          }
        }
      }
    }
  };

  return (
    <div className="peer-comparison-charts-wrapper">
      <div className="charts-two-col">
        {/* Left Chart: Enterprise Value & Capital Structure */}
        <div className="chart-card glass-card">
          <div className="chart-header peer-chart-header">
            <div className="peer-chart-title-row">
              <Layers className="accent-blue" size={20} />
              <h3 className="chart-title">피어 6개사 기업가치(EV) 및 자본구조 비교</h3>
              <span className="badge-hq text-xs peer-chart-badge">2026.06.30 · 억원</span>
            </div>
            <p className="peer-chart-meta">EV = 시가총액 + Net Debt · 풀무원은 녹색으로 표시</p>
          </div>
          <div className="chart-canvas-container" style={{ height: '340px', position: 'relative' }}>
            <Bar data={evChartData} options={evChartOptions} />
          </div>
        </div>

        {/* Right Chart: Interactive Multi-Metric Comparison */}
        <div className="chart-card glass-card">
          <div className="chart-header peer-chart-header">
            <div className="peer-chart-title-row">
              <div className="peer-chart-title-group">
                <Scale className="accent-purple" size={20} />
                <h3 className="chart-title">피어 6개사 핵심 지표 비교</h3>
              </div>
              <span className="badge-hq text-xs peer-chart-badge">기준일은 항목별 상이</span>
            </div>
            <div className="metric-toggle-group" role="tablist" aria-label="피어 비교 지표 선택">
                <button 
                  className={`btn-filter ${activeMetricTab === 'ev_ebitda' ? 'active' : ''}`}
                  onClick={() => setActiveMetricTab('ev_ebitda')}
                  title="2026H1은 최근 12개월(TTM) EBITDA 기준"
                >
                  EV/EBITDA 배수
                </button>
                <button 
                  className={`btn-filter ${activeMetricTab === 'profit' ? 'active' : ''}`}
                  onClick={() => setActiveMetricTab('profit')}
                  title="2026H1 영업이익·EBITDA는 반기 누적 기준"
                >
                  영업이익/EBITDA
                </button>
                <button 
                  className={`btn-filter ${activeMetricTab === 'cum_tsr' ? 'active' : ''}`}
                  onClick={() => setActiveMetricTab('cum_tsr')}
                  title="FY2016 초~FY2025 말 · 귀속 DPS·비재투자 단순누적 기준"
                >
                  누적 TSR (비재투자)
                </button>
                <button 
                  className={`btn-filter ${activeMetricTab === 'pbr_roe' ? 'active' : ''}`}
                  onClick={() => setActiveMetricTab('pbr_roe')}
                  title="2026H1 ROE는 반기 누적이며 연환산하지 않음"
                >
                  ROE / PBR
                </button>
            </div>
          </div>
          <div className="chart-canvas-container" style={{ height: '340px', position: 'relative' }}>
            <Bar data={getMetricChartData()} options={metricChartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}

