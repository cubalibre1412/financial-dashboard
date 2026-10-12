import React from 'react';
import { 
  Building2, 
  TrendingUp, 
  Calendar, 
  PlusCircle, 
  Download, 
  Upload, 
  Sun, 
  Moon, 
  Layers, 
  Sparkles, 
  LineChart, 
  DatabaseBackup 
} from 'lucide-react';

export default function Header({
  companies,
  selectedCompany,
  setSelectedCompany,
  viewMode, // 'company' | 'peer_comparison' | 'benchmarks'
  setViewMode,
  periodType, // 'ALL' | 'ANNUAL' | 'HALF' | 'QUARTER'
  setPeriodType,
  theme,
  toggleTheme,
  onOpenAddModal,
  onExportExcel,
  onExportBenchmark,
  onImportExcel,
  onExportBackup,
  dataManifest,
  dashboardAudience,
  onOpenBoardDashboard,
  onOpenWorkingDashboard
}) {
  const isBoardAudience = dashboardAudience === 'board';
  const isBenchmarkView = viewMode === 'benchmarks';
  const downloadLabel = isBenchmarkView ? '비교지수 다운로드' : '회사 데이터 다운로드';
  const downloadTitle = isBenchmarkView
    ? 'KRX 비교지수와 아파트 매매가격 시계열을 엑셀(.xlsx)로 다운로드'
    : `선택 회사(${selectedCompany})의 현재 계산·보정 전체 시계열을 엑셀(.xlsx)로 다운로드`;

  return (
    <header className="dashboard-header glass-card">
      <div className="header-top-row">
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <TrendingUp className="brand-icon" size={24} />
          </div>
          <div>
            <div className="brand-title-group">
              <h1 className="brand-title">풀무원 이사회 대시보드</h1>
              <span className="badge-pro">{isBoardAudience ? 'BOARD VIEW v7.0' : 'WORKING VIEW v6.0'}</span>
            </div>
            <p className="brand-subtitle">{isBoardAudience ? '공식 장기 성과 · 최신 핵심 KPI · 이사회 점검사항' : 'K-Food 피어그룹 6개사 TSR · 순차입금/Net Debt/EV · 벤치마크 지수 정밀 분석'}</p>
            <p className="brand-subtitle" title="원천 엑셀을 검증 후 추출한 데이터 패키지 기준입니다. 화면에서 업로드·편집한 값은 이 브라우저에만 저장되며 운영 기준값이 아닙니다.">
              {isBoardAudience ? '공식 성과 FY2016~FY2025 · 최신 모니터링 FY2026H1' : `데이터 패키지 ${dataManifest?.dataVersion ?? '확인 중'} · 갱신 ${dataManifest?.generatedAt ? new Date(dataManifest.generatedAt).toLocaleString('ko-KR') : '확인 중'}`}
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn btn-primary" onClick={isBoardAudience ? onOpenWorkingDashboard : onOpenBoardDashboard} id="btn-dashboard-audience-switch">
            {isBoardAudience ? <Building2 size={18} /> : <Sparkles size={18} />}
            <span>{isBoardAudience ? '실무자용 대시보드' : '이사회용 대시보드'}</span>
          </button>

          {!isBoardAudience && <>
          <button 
            className="btn btn-primary"
            onClick={onOpenAddModal}
            id="btn-add-data"
          >
            <PlusCircle size={18} />
            <span>신규 실적 등록 / 업데이트</span>
          </button>

          <button 
            className="btn btn-secondary"
            onClick={isBenchmarkView ? onExportBenchmark : onExportExcel}
            title={downloadTitle}
            id="btn-export-excel"
          >
            <Download size={18} />
            <span>{downloadLabel}</span>
          </button>
          </>}

          <label className="btn btn-secondary btn-file" id="btn-import-excel" title="엑셀 파일 업로드 (전체 데이터 시트)">
            <Upload size={18} />
            <span>엑셀 업로드</span>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              style={{ display: 'none' }} 
              onChange={onImportExcel}
            />
          </label>

          <button 
            className="btn btn-secondary"
            onClick={onExportBackup}
            title="현재 사용자 저장 데이터 전체 백업 파일(.json) 내보내기"
            id="btn-export-backup"
          >
            <DatabaseBackup size={18} />
            <span>데이터 백업</span>
          </button>

          <button 
            className="btn-icon" 
            onClick={toggleTheme}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            id="btn-theme-toggle"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      <div className="header-nav-row">
        {/* Navigation Tabs */}
        <div className="company-tabs">
          {isBoardAudience && (
            <button className={`company-tab ${viewMode === 'company' ? 'active pulmuone-tab' : ''}`} onClick={onOpenBoardDashboard} id="tab-board-summary">
              <Sparkles size={15} className="sparkle-icon" />
              <span>이사회 요약</span>
            </button>
          )}
          {/* Detailed comparison pages belong to the working dashboard, not Board View. */}
          {!isBoardAudience && <button 
            className={`company-tab ${viewMode === 'benchmarks' ? 'active benchmark-active' : ''}`}
            onClick={() => setViewMode('benchmarks')}
            id="tab-benchmarks"
          >
            <LineChart size={16} className="accent-blue" />
            <span className="font-bold">📊 비교 지수 & 벤치마크</span>
            <span className="tab-pill" style={{ background: '#38bdf8' }}>지수</span>
          </button>}

          {/* 2. Peer 6 Comparison Tab */}
          {!isBoardAudience && <button 
            className={`company-tab ${viewMode === 'peer_comparison' ? 'active' : ''}`}
            onClick={() => setViewMode('peer_comparison')}
            id="tab-peer-compare"
          >
            <Layers size={16} />
            <span>피어 6개사 종합 비교</span>
          </button>}

          {!isBoardAudience && <div className="tabs-divider" />}

          {/* 3. Individual Companies */}
          {!isBoardAudience && companies.map((comp) => {
            const isSelected = viewMode === 'company' && selectedCompany === comp;
            const isPulmuone = comp === '풀무원';
            return (
              <button
                key={comp}
                className={`company-tab ${isSelected ? 'active' : ''} ${isPulmuone ? 'pulmuone-tab' : ''}`}
                onClick={() => {
                  setViewMode('company');
                  setSelectedCompany(comp);
                }}
                id={`tab-${comp}`}
              >
                {isPulmuone && <Sparkles size={14} className="sparkle-icon" />}
                <Building2 size={16} />
                <span>{comp}</span>
                {isPulmuone && <span className="tab-pill">본사</span>}
              </button>
            );
          })}
        </div>

        {/* Period Filter Selector */}
        {!isBoardAudience && viewMode === 'company' && (
          <div className="period-pill-selector">
            <Calendar size={15} className="calendar-icon" />
            <span className="period-label">기간 구분:</span>
            {['ALL', 'ANNUAL', 'HALF', 'QUARTER'].map((p) => {
              const labelMap = {
                ALL: '전체',
                ANNUAL: '연간 (FY)',
                HALF: '반기 (1H/2H)',
                QUARTER: '분기 (Q)'
              };
              return (
                <button
                  key={p}
                  className={`period-btn ${periodType === p ? 'active' : ''}`}
                  onClick={() => setPeriodType(p)}
                  id={`period-btn-${p.toLowerCase()}`}
                >
                  {labelMap[p]}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}

