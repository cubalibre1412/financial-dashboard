import React, { useState, useEffect } from 'react';
import { applyApprovedV3Corrections } from './utils/v3Migration';
import Header from './components/Header';
import LatestMonitoringSection from './components/LatestMonitoringSection';
import ValuationChart from './components/ValuationChart';
import PeerComparisonMatrix from './components/PeerComparisonMatrix';
import PeerComparisonCharts from './components/PeerComparisonCharts';
import ExcelDataGrid from './components/ExcelDataGrid';
import DataUpdateModal from './components/DataUpdateModal';
import ExecutiveBriefing from './components/ExecutiveBriefing';
import BenchmarkCenter from './components/BenchmarkCenter';
import BoardDashboard from './components/BoardDashboard';
import { MASTER_DATA } from './data/masterData';
import { DATA_MANIFEST } from './data/dataManifest';
import { exportToExcel, exportBenchmarkToExcel, parseUploadedFile, exportAllDataBackup } from './utils/excelIO';
import { formatPercent, validateAllData, recalculateTimeSeries, getPeriodKind } from './utils/financialCalculators';
import { CheckCircle2, AlertCircle, LineChart, ArrowRight } from 'lucide-react';
import './App.css';

const CURRENT_STORAGE_KEY = 'excelyze_company_data_v5.0';
const LEGACY_STORAGE_KEYS = ['excelyze_company_data_v4.1', 'excelyze_company_data_v4.0', 'excelyze_company_data_v3.3', 'excelyze_company_data_v3.2', 'excelyze_company_data_v3.1', 'excelyze_company_data_v2.7', 'excelyze_company_data_v2.6', 'excelyze_company_data_v2.4', 'excelyze_company_data_v2.3', 'excelyze_company_data_v2.2', 'excelyze_company_data_v2.1', 'excelyze_company_data_v2', 'excelyze_company_data'];
const THEME_KEY = 'excelyze_theme_pref';

export default function App() {
  // Load initial data from localStorage if exists, with safe legacy migration
  const [companiesData, setCompaniesData] = useState(() => {
    try {
      const saved = localStorage.getItem(CURRENT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 저장 데이터 검증: 풀무원/CJ제일제당/대상/오뚜기/농심의 주요 필드 불일치 시 최신 데이터로 갱신
        const pulmuRecords = parsed['풀무원'] || [];
        const r2017 = pulmuRecords.find(r => String(r['연도']).includes('2017'));
        const r2018 = pulmuRecords.find(r => String(r['연도']).includes('2018')); 
        const r2026 = pulmuRecords.find(r => String(r['연도']).includes('2026'));
        const master2017 = MASTER_DATA.companies['풀무원']?.find(r => String(r['연도']).includes('2017'));
        const master2026 = MASTER_DATA.companies['풀무원']?.find(r => String(r['연도']).includes('2026')); 
        
        const cjRecords = parsed['CJ제일제당'] || [];
        const cj2026 = cjRecords.find(r => String(r['연도']).includes('2026'));
        const masterCj2026 = MASTER_DATA.companies['CJ제일제당']?.find(r => String(r['연도']).includes('2026'));

        const daesangRecords = parsed['대상'] || [];
        const daesang2026 = daesangRecords.find(r => String(r['연도']).includes('2026'));
        const masterDaesang2026 = MASTER_DATA.companies['대상']?.find(r => String(r['연도']).includes('2026'));

        const ottogiRecords = parsed['오뚜기'] || [];
        const ottogi2026 = ottogiRecords.find(r => String(r['연도']).includes('2026'));
        const masterOttogi2026 = MASTER_DATA.companies['오뚜기']?.find(r => String(r['연도']).includes('2026'));

        const isStale = (r2017 && master2017 && Number(r2017['DPS']) !== Number(master2017['DPS'])) ||
                        (r2018 && Number(r2018['기초 보유주식수']) >= 2.0) ||
                        (r2026 && (!r2026['2026H1 TTM EBITDA(원)'] || r2026['순차입금/EBITDA (2026H1: TTM)'] === undefined)) ||
                        (r2026 && master2026 && (
                          Number(r2026['기초주가']) !== Number(master2026['기초주가']) ||
                          Number(r2026['2026H1 TTM EBITDA(원)']) !== Number(master2026['2026H1 TTM EBITDA(원)'])
                        )) ||
                        (cj2026 && masterCj2026 && (
                          Number(cj2026['2026H1 TTM EBITDA(원)']) !== Number(masterCj2026['2026H1 TTM EBITDA(원)'])
                        )) ||
                        (daesang2026 && masterDaesang2026 && (
                          Number(daesang2026['2026H1 TTM EBITDA(원)']) !== Number(masterDaesang2026['2026H1 TTM EBITDA(원)'])
                        )) ||
                        (ottogi2026 && masterOttogi2026 && (
                          Number(ottogi2026['2026H1 TTM EBITDA(원)']) !== Number(masterOttogi2026['2026H1 TTM EBITDA(원)'])
                        ));
        if (!isStale) {
          return applyApprovedV3Corrections(parsed);
        }
        console.info('[Storage] Detected legacy/stale data in storage. Auto-refreshing with approved v5.0 master data.');
      }
      
      // 마이그레이션: 이전 버전 키 검사
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacySaved = localStorage.getItem(legacyKey);
        if (legacySaved) {
          const parsedLegacy = JSON.parse(legacySaved);
          // 데이터 정합성 확인
          const pRecs = parsedLegacy['풀무원'] || [];
          const r2017 = pRecs.find(r => String(r['연도']).includes('2017'));
          const r2018 = pRecs.find(r => String(r['연도']).includes('2018')); 
          const r2026 = pRecs.find(r => String(r['연도']).includes('2026'));
          const cjRecs = parsedLegacy['CJ제일제당'] || [];
          const cj2026 = cjRecs.find(r => String(r['연도']).includes('2026'));
          const master2017 = MASTER_DATA.companies['풀무원']?.find(r => String(r['연도']).includes('2017'));
          const masterCj2026 = MASTER_DATA.companies['CJ제일제당']?.find(r => String(r['연도']).includes('2026')); 

          const isStale = (r2017 && master2017 && Number(r2017['DPS']) !== Number(master2017['DPS'])) ||
                        (r2018 && Number(r2018['기초 보유주식수']) >= 2.0) || 
                          (r2026 && (!r2026['2026H1 TTM EBITDA(원)'] || r2026['순차입금/EBITDA (2026H1: TTM)'] === undefined)) ||
                          (cj2026 && masterCj2026 && (
                            Number(cj2026['2026H1 TTM EBITDA(원)']) !== Number(masterCj2026['2026H1 TTM EBITDA(원)'])
                          ));
          
          if (!isStale) {
            console.info(`[Storage] Migrated user data from ${legacyKey} to ${CURRENT_STORAGE_KEY}`);
            localStorage.setItem(CURRENT_STORAGE_KEY, JSON.stringify(parsedLegacy));
            return applyApprovedV3Corrections(parsedLegacy);
          }
        }
      }
    } catch (e) {
      console.error('Error loading stored data:', e);
    }
    // 승인된 v5.0 마스터 데이터로 기본 초기화
    localStorage.setItem(CURRENT_STORAGE_KEY, JSON.stringify(MASTER_DATA.companies));
    return applyApprovedV3Corrections(MASTER_DATA.companies);
  });

  const [benchmarkData] = useState(MASTER_DATA.benchmarks);
  const [selectedCompany, setSelectedCompany] = useState('풀무원');
  const [viewMode, setViewMode] = useState('company'); // 'company' | 'peer_comparison' | 'benchmarks'
  // 이사회용 화면을 항상 기본 진입점으로 두고, 실무자용은 명시적 전환으로만 연다.
  const [dashboardAudience, setDashboardAudience] = useState('board');
  const [periodType, setPeriodType] = useState('ALL'); // 'ALL' | 'ANNUAL' | 'HALF' | 'QUARTER'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Theme state
  const [theme, setTheme] = useState(() => {
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // App 시작 시 데이터 무결성 검증 콘솔 실행
  useEffect(() => {
    console.group('🔍 [Excelyze v3.1] 데이터 무결성 검증 로그');
    console.info('Master Data Version:', MASTER_DATA.metadata?.dataVersion || '3.1');
    console.info('Extracted At:', MASTER_DATA.metadata?.extractedAt);
    validateAllData(MASTER_DATA);
    console.groupEnd();
  }, []);

  // Persist companiesData to localStorage
  const saveCompaniesData = (newData) => {
    setCompaniesData(newData);
    try {
      localStorage.setItem(CURRENT_STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.error('Error saving data:', e);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const openBoardDashboard = () => {
    setDashboardAudience('board');
    setSelectedCompany('풀무원');
    setViewMode('company');
  };

  const openWorkingDashboard = (targetView = 'company') => {
    setDashboardAudience('working');
    setViewMode(targetView);
  };

  // Company list
  const companyList = Object.keys(companiesData);

  // Filter records based on selected period type
  const rawRecords = companiesData[selectedCompany] || [];
  const activeRecords = rawRecords.filter(r => {
    if (periodType === 'ALL') return true;
    const kind = getPeriodKind(r['연도']);
    if (periodType === 'ANNUAL') return kind === 'ANNUAL';
    if (periodType === 'HALF') return kind === 'HALF';
    if (periodType === 'QUARTER') return kind === 'QUARTER';
    return true;
  });

  const latestRecord = activeRecords[activeRecords.length - 1] || rawRecords[rawRecords.length - 1];
  const prevRecord = activeRecords.length > 1 ? activeRecords[activeRecords.length - 2] : null;

  // Quick Benchmark Summary Stats
  const kospiRows = (benchmarkData?.krx || []).filter(r => r['지수명'] === 'KOSPI');
  const latestKospi = kospiRows[kospiRows.length - 1] || {};
  const consumerRows = (benchmarkData?.krx || []).filter(r => r['지수명'] === '코스피 200 생활소비재');
  const latestConsumer = consumerRows[consumerRows.length - 1] || {};
  
  // 전국 아파트 PR: 시장·대체투자 비교의 공식 기준
  const nationalAptRows = (benchmarkData?.krx || []).filter(r => r['지수명'] === '전국 아파트');
  const latestNationalApt = nationalAptRows[nationalAptRows.length - 1] || {};
  const nationalAnnualReturn = latestNationalApt['연간수익률'] !== undefined ? Number(latestNationalApt['연간수익률']) : null;

  // Handlers
  const handleSaveRecord = (companyName, newRecord) => {
    const existing = companiesData[companyName] || [];
    const idx = existing.findIndex(r => String(r['연도']) === String(newRecord['연도']));
    let updated;
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...updated[idx], ...newRecord };
    } else {
      updated = [...existing, newRecord];
    }
    const recalculated = recalculateTimeSeries(updated);

    const newData = {
      ...companiesData,
      [companyName]: recalculated
    };
    saveCompaniesData(newData);
    showToast(`${companyName} ${newRecord['연도']} 실적이 성공적으로 반영되었습니다.`);
  };

  const handleUpdateGridRecord = (targetPeriod, updatedRecord) => {
    const existing = [...rawRecords];
    const rawIdx = existing.findIndex(r => r['연도'] === targetPeriod);
    if (rawIdx >= 0) {
      existing[rawIdx] = updatedRecord;
      const recalculated = recalculateTimeSeries(existing);
      const newData = {
        ...companiesData,
        [selectedCompany]: recalculated
      };
      saveCompaniesData(newData);
      showToast(`${selectedCompany} ${updatedRecord['연도']} 데이터가 수정되었습니다.`);
    }
  };

  const handleDeleteRecord = (targetPeriod) => {
    if (window.confirm(`${selectedCompany}의 ${targetPeriod} 데이터를 삭제하시겠습니까?`)) {
      const existing = rawRecords.filter(r => r['연도'] !== targetPeriod);
      const recalculated = recalculateTimeSeries(existing);
      const newData = {
        ...companiesData,
        [selectedCompany]: recalculated
      };
      saveCompaniesData(newData);
      showToast(`${targetPeriod} 데이터가 삭제되었습니다.`);
    }
  };

  const handleResetToOriginal = () => {
    if (window.confirm(`${selectedCompany} 데이터를 초기 엑셀 원본으로 되돌리시겠습니까?`)) {
      const original = applyApprovedV3Corrections({
        [selectedCompany]: MASTER_DATA.companies[selectedCompany] || []
      })[selectedCompany] || [];
      const newData = {
        ...companiesData,
        [selectedCompany]: original
      };
      saveCompaniesData(newData);
      showToast(`${selectedCompany} 원본 데이터로 복원되었습니다.`);
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(selectedCompany, rawRecords, DATA_MANIFEST);
      showToast(`${selectedCompany} 전체 시계열 엑셀 파일(.xlsx)이 다운로드되었습니다.`);
    } catch (error) {
      showToast(error.message || '회사별 엑셀 파일을 만들지 못했습니다.', 'error');
    }
  };

  const handleExportBenchmark = () => {
    try {
      exportBenchmarkToExcel(benchmarkData, DATA_MANIFEST);
      showToast('비교지수 엑셀 파일(.xlsx)이 다운로드되었습니다.');
    } catch (error) {
      showToast(error.message || '비교지수 엑셀 파일을 만들지 못했습니다.', 'error');
    }
  };

  const handleExportBackup = () => {
    exportAllDataBackup(companiesData, MASTER_DATA.metadata?.version || '2.3.0');
    showToast('전체 사용자 데이터 백업 파일(.json)이 다운로드되었습니다.');
  };

  const handleImportExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    parseUploadedFile(file, (err, res) => {
      if (err) {
        showToast('엑셀 파일 파싱 중 오류가 발생했습니다: ' + err.message, 'error');
        return;
      }
      if (res.data && res.data.length > 0) {
        const periods = res.data.map(r => r['연도']).join(', ');
        if (!window.confirm(`${selectedCompany}의 기존 ${rawRecords.length}개 기간 데이터를 업로드 파일의 ${res.data.length}개 기간으로 교체합니다.\n\n대상 기간: ${periods}\n\n화면 업로드 값은 이 브라우저에만 저장되며 운영 기준 데이터는 변경되지 않습니다. 계속하시겠습니까?`)) return;
        const recalculated = recalculateTimeSeries(res.data);
        const newData = {
          ...companiesData,
          [selectedCompany]: recalculated
        };
        saveCompaniesData(newData);
        showToast(`${selectedCompany}에 엑셀 데이터(${res.data.length}개 행)가 성공적으로 로드되었습니다!`);
      }
    });
    e.target.value = '';
  };

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Main Top Header */}
      <Header 
        companies={companyList}
        selectedCompany={selectedCompany}
        setSelectedCompany={setSelectedCompany}
        viewMode={viewMode}
        setViewMode={setViewMode}
        periodType={periodType}
        setPeriodType={setPeriodType}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onExportExcel={handleExportExcel}
        onExportBenchmark={handleExportBenchmark}
        onImportExcel={handleImportExcel}
        onExportBackup={handleExportBackup}
        dataManifest={DATA_MANIFEST}
        dashboardAudience={dashboardAudience}
        onOpenBoardDashboard={openBoardDashboard}
        onOpenWorkingDashboard={openWorkingDashboard}
      />

      <main className="dashboard-content">
        {/* v7 Board View: official board reporting is intentionally separated from working tools. */}
        {dashboardAudience === 'board' && viewMode === 'company' && (
          <BoardDashboard
            records={companiesData['풀무원'] || []}
            allCompaniesData={companiesData}
            benchmarkData={benchmarkData}
            onOpenWorkingDashboard={openWorkingDashboard}
            onOpenBenchmarks={() => openWorkingDashboard('benchmarks')}
            onOpenPeerComparison={() => openWorkingDashboard('peer_comparison')}
          />
        )}

        {dashboardAudience === 'board' && viewMode === 'benchmarks' && (
          <BenchmarkCenter 
            benchmarkData={benchmarkData}
            pulmuoneRecords={companiesData['풀무원']}
            theme={theme}
          />
        )}

        {dashboardAudience === 'board' && viewMode === 'peer_comparison' && (
          <>
            <PeerComparisonMatrix 
              allCompaniesData={companiesData}
              onSelectCompany={openWorkingDashboard}
            />
            <PeerComparisonCharts 
              allCompaniesData={companiesData}
              theme={theme}
              onSelectCompany={openWorkingDashboard}
            />
          </>
        )}

        {/* v6 Working View: preserve current detailed analysis and data-management functions. */}
        {dashboardAudience === 'working' && viewMode === 'benchmarks' && (
          <BenchmarkCenter 
            benchmarkData={benchmarkData}
            pulmuoneRecords={companiesData['풀무원']}
            theme={theme}
          />
        )}

        {/* VIEW 2: Company Deepdive View */}
        {dashboardAudience === 'working' && viewMode === 'company' && (
          <>
            {/* Quick Benchmark Comparison Ticker */}
            <div className="benchmark-quick-ticker glass-card" onClick={() => setViewMode('benchmarks')}>
              <div className="ticker-left">
                <LineChart size={16} className="accent-blue" />
                <span className="font-semibold text-xs text-primary">주요 벤치마크 현황:</span>
                <div className="ticker-item">
                  <span className="ticker-lbl">KOSPI TR ('26 상반기):</span>
                  <span className={`ticker-val tabular-nums ${Number(latestKospi['연간수익률']) >= 0 ? 'color-pos' : 'color-neg'}`}>
                    {formatPercent(latestKospi['연간수익률'])}
                  </span>
                </div>
                <div className="ticker-item">
                  <span className="ticker-lbl">코스피 200 생활소비재 TR ('26 상반기):</span>
                  <span className={`ticker-val tabular-nums ${Number(latestConsumer['연간수익률']) >= 0 ? 'color-pos' : 'color-neg'}`}>
                    {formatPercent(latestConsumer['연간수익률'])}
                  </span>
                </div>
                <div className="ticker-item">
                  <span className="ticker-lbl">전국 아파트 가격 변동률(PR, '26 상반기):</span>
                  <span className={`ticker-val tabular-nums ${nationalAnnualReturn >= 0 ? 'color-pos' : 'color-neg'}`}>
                    {formatPercent(nationalAnnualReturn)}
                  </span>
                </div>
              </div>
              <div className="ticker-right">
                <span>비교 지수 센터 전체보기</span>
                <ArrowRight size={14} />
              </div>
            </div>

            {/* Executive Briefing Report - conclusion-first board hierarchy */}
            <ExecutiveBriefing key={selectedCompany}
              companyName={selectedCompany}
              // 경영진 브리핑의 1·3·5·10년 비교는 기간 필터와 무관한 전체 시계열 기준이다.
              records={rawRecords}
              allCompaniesData={companiesData}
              benchmarkData={benchmarkData}
              onOpenBenchmarks={() => setViewMode('benchmarks')}
            />

            {/* Latest monitoring is intentionally separate from the fixed FY2016-FY2025 board assessment. */}
            <LatestMonitoringSection
              companyName={selectedCompany}
              currentRecord={latestRecord}
              prevRecord={prevRecord}
              allRecords={rawRecords}
              peerAvg={{ evEbitda: 8.8 }}
            />

            {/* Enterprise Value & Multiple Breakdown */}
            <div className="chart-full-width">
              <ValuationChart 
                companyName={selectedCompany}
                records={activeRecords}
                theme={theme}
              />
            </div>

            {/* In-browser Editable Data Grid */}
            <ExcelDataGrid 
              companyName={selectedCompany}
              records={activeRecords}
              onUpdateRecord={handleUpdateGridRecord}
              onDeleteRecord={handleDeleteRecord}
              onResetToOriginal={handleResetToOriginal}
            />
          </>
        )}

        {/* VIEW 3: Peer 6 Comparison View */}
        {dashboardAudience === 'working' && viewMode === 'peer_comparison' && (
          <>
            {/* Matrix Table */}
            <PeerComparisonMatrix 
              allCompaniesData={companiesData}
              onSelectCompany={(name) => {
                setSelectedCompany(name);
                setViewMode('company');
              }}
            />

            {/* Visual Chart Representation */}
            <PeerComparisonCharts 
              allCompaniesData={companiesData}
              theme={theme}
              onSelectCompany={(name) => {
                setSelectedCompany(name);
                setViewMode('company');
              }}
            />
          </>
        )}
      </main>

      {/* Modal for adding/updating quarterly/half/yearly data */}
      {dashboardAudience === 'working' && <DataUpdateModal 
        key={`${selectedCompany}-${isAddModalOpen}`}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        companies={companyList}
        initialCompany={selectedCompany}
        existingRecords={companiesData}
        onSaveRecord={handleSaveRecord}
      />}
    </div>
  );
}


