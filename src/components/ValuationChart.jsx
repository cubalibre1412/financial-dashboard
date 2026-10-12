import React from 'react';
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
import { Chart } from 'react-chartjs-2';
import { Activity } from 'lucide-react';
import { formatKRW, getMarketCap, getNetDebtBroad } from '../utils/financialCalculators';

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

export default function ValuationChart({ 
  companyName, 
  records, 
  theme 
}) {
  if (!records || records.length === 0) return null;

  const labels = records.map(r => `${r['연도']}`);
  const marketCapData = records.map(r => getMarketCap(r) ?? 0);
  const netDebtData = records.map(r => getNetDebtBroad(r) ?? 0);
  const evData = records.map(r => Number(r['EV(원)']) || 0);
  const evEbitdaData = records.map(r => {
    const val = Number(r['EV/EBITDA']);
    return val > 0 && val < 50 ? Math.round(val * 10) / 10 : null;
  });

  const chartData = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: '시가총액 (Market Cap)',
        data: marketCapData,
        backgroundColor: 'rgba(56, 189, 248, 0.75)',
        borderColor: '#38bdf8',
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'Net Debt',
        data: netDebtData,
        backgroundColor: netDebtData.map(v => v >= 0 ? 'rgba(244, 63, 94, 0.75)' : 'rgba(16, 185, 129, 0.75)'),
        borderColor: netDebtData.map(v => v >= 0 ? '#f43f5e' : '#10b981'),
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: 'EV / EBITDA 배수 (우측축)',
        data: evEbitdaData,
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderWidth: 3,
        pointBackgroundColor: '#f59e0b',
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y1',
        tension: 0.2
      }
    ]
  };

  const chartOptions = {
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
        padding: 12,
        callbacks: {
          label: (ctx) => {
            if (ctx.dataset.yAxisID === 'y1') {
              return ` ${ctx.dataset.label}: ${ctx.parsed.y}배`;
            }
            const val = ctx.parsed.y;
            if (ctx.dataset.label === 'Net Debt') {
              const note = val < 0 ? ' (음수: EV 차감 효과)' : '';
              return ` ${ctx.dataset.label}: ${formatKRW(val)}${note}`;
            }
            return ` ${ctx.dataset.label}: ${formatKRW(val)}`;
          },
          footer: (items) => {
            if (items.length > 0) {
              const idx = items[0].dataIndex;
              const ev = evData[idx];
              const mc = marketCapData[idx];
              const nd = netDebtData[idx];
              const ndSign = nd >= 0 ? '+' : '-';
              return `\n합산 EV: ${formatKRW(ev)} (시가총액 ${formatKRW(mc)} ${ndSign} Net Debt ${formatKRW(Math.abs(nd))})`;
            }
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b'
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        grid: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          callback: (v) => formatKRW(v, false)
        },
        title: {
          display: true,
          text: '금액 (원)',
          color: theme === 'dark' ? '#64748b' : '#94a3b8'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          color: '#f59e0b',
          callback: (v) => `${v}배`
        },
        title: {
          display: true,
          text: 'EV/EBITDA (배수)',
          color: '#f59e0b'
        }
      }
    }
  };

  return (
    <div className="chart-card glass-card">
      <div className="chart-header">
        <div>
          <div className="chart-title-row">
            <Activity className="accent-purple" size={20} />
            <h3 className="chart-title">{companyName} 기업가치(EV) 구조 및 배수 추이</h3>
          </div>
          <p className="chart-desc">
            <strong>시가총액 + Net Debt = 기업가치(EV)</strong>와 EBITDA 대비 밸류에이션 배수(EV/EBITDA) 연도별 추이. (Net Debt = 순차입금 + 리스부채 + 신종자본증권 + 비지배지분; 음수 Net Debt는 시가총액에서 차감되어 EV 감소 효과 반영)
          </p>
        </div>
      </div>

      <div className="chart-body-wrapper" style={{ height: 350 }}>
        <Chart type="bar" data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
