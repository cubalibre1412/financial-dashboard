import React, { useState } from 'react';
import { Table, Trash2, Check, RotateCcw } from 'lucide-react';
import { formatPercent, formatKRW, recalculateRecord } from '../utils/financialCalculators';

export default function ExcelDataGrid({ 
  companyName, 
  records, 
  onUpdateRecord, 
  onDeleteRecord,
  onResetToOriginal 
}) {
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, colKey }
  const [cellValue, setCellValue] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  if (!records || records.length === 0) return null;

  // Key columns to show in primary grid (순차입금과 Net Debt 분리)
  const columns = [
    { key: "연도", label: "연도/주기", width: 85, sticky: true },
    { key: "기초주가", label: "기초주가", isCurrency: true },
    { key: "기말주가", label: "기말주가", isCurrency: true },
    { key: "DPS", label: "DPS", isCurrency: true },
    { key: "주가수익률(가격 기준)", label: "주가수익률", isPercent: true },
    { key: "DPS 기반 TSR 보정 효과", label: "DPS 보정", isPercent: true },
    { key: "연간 TSR", label: "TSR", isPercent: true },
    { key: "시가총액(원)", label: "시가총액", isBigKRW: true, fallbackKey: "시가총액 (원)" },
    { key: "순차입금(원)", label: "순차입금", isBigKRW: true },
    { key: "Net Debt(B)", label: "Net Debt", isBigKRW: true, fallbackKey: "Net Debt" },
    { key: "EV(원)", label: "EV", isBigKRW: true },
    { key: "EBIT(원)", label: "EBIT", isBigKRW: true },
    { key: "EBITDA(원)", label: "EBITDA", isBigKRW: true },
    { key: "EV/EBITDA", label: "EV/EBITDA", isMultiple: true },
    { key: "순차입금/EBITDA (2026H1: TTM)", label: "순차입금/EBITDA", isMultiple: true },
    { key: "EBITDA 증감률 (2026H1: TTM vs FY2025)", label: "EBITDA 증감", isPercent: true },
    { key: "PER", label: "PER", isMultiple: true, checkLoss: true },
    { key: "PBR", label: "PBR", isMultiple: true },
    { key: "ROE", label: "ROE", isPercent: true },
    { key: "배당 귀속기준 및 반기 특이사항", label: "배당 특이사항", width: 180 }
  ];

  const handleCellClick = (period, colKey, curVal) => {
    setEditingCell({ period, colKey });
    setCellValue(curVal !== undefined && curVal !== null ? String(curVal) : '');
  };

  const handleSaveCell = (period, colKey) => {
    const sourceRecord = records.find(r => String(r['연도']) === String(period));
    if (!sourceRecord) return;
    const rawUpdated = { ...sourceRecord };
    const numVal = Number(cellValue);
    rawUpdated[colKey] = (cellValue === '' || isNaN(numVal)) ? (cellValue === '' ? null : cellValue) : numVal;
    
    // 통일된 재계산 엔진으로 의존관계 전수 일괄 갱신
    // (재무구성항목 → 순차입금 → Net Debt → EV → EV/EBITDA, 손익/자본 → 배수/수익성, 주가/배당 → 당기 TSR)
    const verifiedRecord = recalculateRecord(rawUpdated);

    onUpdateRecord(period, verifiedRecord);
    setEditingCell(null);
  };

  const filteredRecords = records.filter(r => {
    if (!filterQuery) return true;
    return String(r['연도']).toLowerCase().includes(filterQuery.toLowerCase());
  });

  const formatDisplayValue = (val, col, row) => {
    if (col.key === 'PER' && String(row?.['연도']).includes('2026') && (companyName === 'CJ제일제당' || companyName === '대상')) {
      return <span className="text-danger font-semibold">N/M (적자)</span>;
    }
    if (val === undefined || val === null || val === '') return '-';
    if (col.isPercent) return formatPercent(val);
    if (col.isBigKRW) return formatKRW(val);
    if (col.isCurrency) return `${Number(val).toLocaleString()}원`;
    if (col.isMultiple) {
      const n = Number(val);
      return n > 0 ? `${n.toFixed(1)}배` : '-';
    }
    return String(val);
  };

  return (
    <div className="table-card glass-card">
      <div className="grid-header-bar">
        <div className="chart-title-row">
          <Table className="accent-blue" size={20} />
          <h3 className="chart-title">{companyName} 원천 시계열 데이터 그리드 (인라인 편집 지원)</h3>
        </div>
        
        <div className="grid-actions-bar">
          <input 
            type="text" 
            placeholder="연도 / 기간 검색..." 
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="grid-search-input"
          />
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onResetToOriginal}
            title="초기 엑셀 원본 데이터로 복원"
          >
            <RotateCcw size={14} />
            <span>원본 복원</span>
          </button>
        </div>
      </div>

      <p className="chart-desc px-4 mb-2">
        💡 셀을 클릭하여 값을 수정한 뒤 Enter 또는 체크 버튼을 누르면 순차입금, Net Debt, EV, EBITDA, TSR 및 차트가 실시간 자동 연동 갱신됩니다.
      </p>

      <div className="table-responsive grid-scroll-area">
        <table className="editable-data-grid">
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>No.</th>
              {columns.map(c => (
                <th key={c.key} className={c.sticky ? 'sticky-col' : ''}>
                  {c.label}
                </th>
              ))}
              <th style={{ width: 48, textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record, rIdx) => (
              <tr key={record['연도'] || rIdx} className="grid-row">
                <td className="text-muted text-xs text-center">{rIdx + 1}</td>
                {columns.map(c => {
                  const rawVal = record[c.key] !== undefined ? record[c.key] : (c.fallbackKey ? record[c.fallbackKey] : undefined);
                  const isEditing = editingCell?.period === record['연도'] && editingCell?.colKey === c.key;

                  return (
                    <td 
                      key={c.key} 
                      className={`grid-cell ${c.sticky ? 'sticky-col font-semibold' : ''} ${c.isPercent ? (Number(rawVal) >= 0 ? 'color-pos' : 'color-neg') : ''}`}
                      onClick={() => !isEditing && handleCellClick(record['연도'], c.key, rawVal)}
                    >
                      {isEditing ? (
                        <div className="cell-edit-wrapper" onClick={e => e.stopPropagation()}>
                          <input 
                            type="text" 
                            value={cellValue} 
                            onChange={e => setCellValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveCell(record['연도'], c.key);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            autoFocus 
                            className="cell-input"
                          />
                          <button 
                            className="cell-save-btn" 
                            onClick={() => handleSaveCell(record['연도'], c.key)}
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="cell-val-text tabular-nums">
                          {formatDisplayValue(rawVal, c, record)}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center">
                  <button 
                    className="row-delete-btn" 
                    onClick={() => onDeleteRecord(record['연도'])}
                    title="해당 행 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
