import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import XLSX from 'xlsx';

const root = path.resolve(import.meta.dirname, '..');
const sourceDir = path.resolve(root, '..');
const outDir = path.join(root, 'src', 'data');
const reportDir = path.join(root, 'docs', 'data-refresh');
const apply = process.argv.includes('--apply');

const companies = {
  '풀무원': '풀무원_TSR_Valuation_2016_2026.xlsx',
  'CJ제일제당': 'CJ제일제당_TSR_Valuation_2016_2026.xlsx',
  '농심': '농심_TSR_Valuation_2016_2026.xlsx',
  '삼양식품': '삼양식품_TSR_Valuation_2016_2026.xlsx',
  '대상': '대상_TSR_Valuation_2016_2026.xlsx',
  '오뚜기': '오뚜기_TSR_Valuation_2016_2026.xlsx',
};
const fields = [
  ['연도',['연도']], ['기초주가',['기초주가']], ['기말주가',['기말주가']], ['DPS',['DPS','주당배당금(DPS)']],
  ['기초 보유주식수',['기초 보유주식수']], ['수령 배당금',['수령 배당금']], ['재투자 단가',['재투자 단가']],
  ['추가 매수주식수',['추가 매수주식수']], ['기말 보유주식수',['기말 보유주식수']], ['주가평가액',['주가평가액']],
  ['최종가치(배당재투자)',['최종가치(배당재투자)']], ['연간 TSR',['연간 TSR']],
  ['시가총액(원)',['시가총액(원)','시가총액 (원)']], ['현금 및 현금성 자산(원)',['현금 및 현금성 자산(원)','현금 및 현금성자산(원)','현금및현금성자산(원)']],
  ['단기금융자산(원)',['단기금융자산(원)','단기금융상품(원)']], ['단기투자자산(원)',['단기투자자산(원)']],
  ['차입금(원)',['차입금(원)']], ['단기차입금(원)',['단기차입금(원)']], ['장기차입금(원)',['장기차입금(원)']],
  ['순차입금(원)',['순차입금(원)']], ['리스부채(원)',['리스부채(원)']], ['신종자본증권(원)',['신종자본증권(원)']], ['비지배지분(원)',['비지배지분(원)']],
  ['Net Debt(B)',['Net Debt(B)','Net Debt']], ['EV(원)',['EV(원)']], ['EBIT(원)',['EBIT(원)']], ['감가상각비(원)',['감가상각비(원)','감가상각비(유형+사용권)(원)','감가상각비']],
  ['투자부동산감가상각비(원)',['투자부동산감가상각비(원)']], ['무형자산상각비(원)',['무형자산상각비(원)']], ['EBITDA(원)',['EBITDA(원)']], ['EV/EBITDA',['EV/EBITDA']],
  ['순이익(원)',['순이익(원)','지배주주순이익(원)']], ['자기자본(원)',['자기자본(원)','지배주주지분(원)']], ['평균자기자본(원)',['평균자기자본(원)']], ['PER',['PER']], ['PBR',['PBR']], ['ROE',['ROE']],
  ['배당 귀속기준 및 반기 특이사항',['배당 귀속기준 및 반기 특이사항']], ['2026H1 TTM EBITDA(원)',['2026H1 TTM EBITDA(원)']], ['2026H1 TTM 지배주주순이익(원)',['2026H1 TTM 지배주주순이익(원)']], ['2026H1 TTM 기준',['2026H1 TTM 기준']], ['기간·비교 기준',['기간·비교 기준','기간별 메모']],
  ['주가수익률(가격 기준)',['주가수익률(가격 기준)','주가수익률']], ['DPS 기반 TSR 보정 효과',['DPS 기반 TSR 보정 효과','DPS 보정 효과']], ['순차입금/EBITDA (2026H1: TTM)',['순차입금/EBITDA (2026H1: TTM)','순차입금/EBITDA']], ['EBITDA 증감률 (2026H1: TTM vs FY2025)',['EBITDA 증감률 (2026H1: TTM vs FY2025)','EBITDA 증감률']],
];
const required = ['연도','기초주가','기말주가','DPS','시가총액(원)','현금 및 현금성 자산(원)','차입금(원)','순차입금(원)','Net Debt(B)','EV(원)','EBITDA(원)'];
const number = value => typeof value === 'string' && /^-?[\d,.]+$/.test(value.trim()) ? Number(value.replaceAll(',','')) : value;
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const stamp = () => new Date().toISOString().replace(/[:.]/g,'-').replace('T','_').slice(0,19);


function recomputeTsrChain(rows) {
  let priorClosingShares = null;
  return rows.map((row, index) => {
    const beginningPrice = Number(row['기초주가']);
    const endingPrice = Number(row['기말주가']);
    const dps = Number(row['DPS']);
    const storedOpeningShares = Number(row['기초 보유주식수']);
    const openingShares = index === 0 ? storedOpeningShares : priorClosingShares;
    if (![beginningPrice, endingPrice, dps, openingShares].every(Number.isFinite) || beginningPrice <= 0 || endingPrice <= 0 || openingShares < 0) {
      priorClosingShares = Number.isFinite(storedOpeningShares) ? storedOpeningShares : priorClosingShares;
      return row;
    }
    const dividendReceived = openingShares * dps;
    const addedShares = dividendReceived / endingPrice;
    const closingShares = openingShares + addedShares;
    const priceValue = closingShares * endingPrice;
    const annualTsr = (endingPrice - beginningPrice + dps) / beginningPrice;
    priorClosingShares = closingShares;
    return {
      ...row,
      '기초 보유주식수': openingShares,
      '수령 배당금': dividendReceived,
      '재투자 단가': endingPrice,
      '추가 매수주식수': addedShares,
      '기말 보유주식수': closingShares,
      '주가평가액': priceValue,
      '최종가치(배당재투자)': priceValue,
      '연간 TSR': annualTsr,
      '주가수익률(가격 기준)': (endingPrice - beginningPrice) / beginningPrice,
      'DPS 기반 TSR 보정 효과': dps / beginningPrice,
    };
  });
}

function readCompany(name, file) {
  const wb = XLSX.readFile(file, {cellDates:false});
  if (!wb.SheetNames.includes('전체 데이터')) throw new Error(`${name}: '전체 데이터' 시트가 없습니다.`);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets['전체 데이터'], {defval:null});
  if (raw.length !== 11) throw new Error(`${name}: 데이터 행 수가 ${raw.length}개입니다. 2016~2026의 11개 행이어야 합니다.`);
  const years = raw.map(r => String(r['연도'] ?? '').trim());
  if (new Set(years).size !== raw.length || !years.some(y=>y.startsWith('2016')) || !years.some(y=>y.startsWith('2026'))) throw new Error(`${name}: 연도 키가 중복되었거나 2016/2026 행이 없습니다.`);
  const missing = required.filter(key => !fields.find(([standard])=>standard===key)[1].some(candidate => Object.hasOwn(raw[0], candidate)));
  if (missing.length) throw new Error(`${name}: 필수 열 누락 - ${missing.join(', ')}`);
  const normalized = raw.map(row => Object.fromEntries(fields.map(([standard,candidates]) => {
    const key = candidates.find(candidate => row[candidate] !== null && row[candidate] !== undefined);
    return [standard, key ? number(row[key]) : null];
  })));
  return recomputeTsrChain(normalized);
}

function readBenchmarks(file) {
  const wb = XLSX.readFile(file, {cellDates:false});
  const krxSheet = wb.Sheets['KRX 지수'];
  const aptSheet = wb.Sheets['한국부동산원 아파트 매매가격지수'];
  if (!krxSheet || !aptSheet) throw new Error('비교지수: KRX 지수 또는 한국부동산원 아파트 매매가격지수 시트가 없습니다.');
  const krx = XLSX.utils.sheet_to_json(krxSheet, {defval:null}).filter(r=>r['연도']!=null && r['지수명']!=null).map(r=>({
    '연도':number(r['연도']), '지수명':String(r['지수명']).trim(), '구분':String(r['구분']??'').trim(), '지표':String(r['지표']??'').trim(), '기초값':number(r['기초값']), '기말값':number(r['기말값']), '연간수익률':number(r['연간수익률'])
  }));
  if (krx.length !== 66) throw new Error(`비교지수: KRX 행 수가 ${krx.length}개입니다. 66개여야 합니다.`);
  const apartment = XLSX.utils.sheet_to_json(aptSheet, {defval:null}).filter(r=>r['자료시점']!=null && typeof r['전국']==='number' && typeof r['서울']==='number').map(r=>({'자료시점':String(r['자료시점']).trim(),'전국':r['전국'],'서울':r['서울']}));
  if (apartment.length < 120) throw new Error(`비교지수: 아파트 유효 행 수가 ${apartment.length}개입니다. 최소 120개여야 합니다.`);
  return {krx, apartment};
}

function parseExisting() {
  const file = path.join(outDir,'masterData.js');
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file,'utf8');
  const match = content.match(/export const MASTER_DATA = ([\s\S]+);\s*$/);
  return match ? JSON.parse(match[1]) : null;
}
function diff(oldData, nextData) {
  if (!oldData) return {changedRecords:0, samples:[]};
  const samples=[]; let changedRecords=0;
  for (const [company, rows] of Object.entries(nextData.companies)) rows.forEach((row,index)=>{
    const old=oldData.companies?.[company]?.[index] ?? {}; const fieldsChanged=Object.keys(row).filter(k=>JSON.stringify(old[k]??null)!==JSON.stringify(row[k]??null));
    if(fieldsChanged.length){changedRecords++; if(samples.length<30)samples.push({company,period:row['연도'],fields:fieldsChanged});}
  });
  return {changedRecords,samples};
}

try {
  const sourceFiles={}; const data={metadata:{schemaVersion:'3.1',extractedAt:new Date().toISOString(),sourceFiles},companies:{},benchmarks:{}};
  for (const [company,fileName] of Object.entries(companies)) {
    const file=path.join(sourceDir,fileName); if(!fs.existsSync(file)) throw new Error(`원천 파일 없음: ${fileName}`);
    data.companies[company]=readCompany(company,file);
    const stat=fs.statSync(file); sourceFiles[company]={fileName,bytes:stat.size,modifiedAt:stat.mtime.toISOString(),sha256:sha256(file),rows:data.companies[company].length};
  }
  const benchmarkName='비교 지수 데이터.xlsx'; const benchmarkFile=path.join(sourceDir,benchmarkName);
  if(!fs.existsSync(benchmarkFile)) throw new Error(`원천 파일 없음: ${benchmarkName}`);
  data.benchmarks=readBenchmarks(benchmarkFile);
  const bstat=fs.statSync(benchmarkFile); sourceFiles.benchmarks={fileName:benchmarkName,bytes:bstat.size,modifiedAt:bstat.mtime.toISOString(),sha256:sha256(benchmarkFile),krxRows:data.benchmarks.krx.length,apartmentRows:data.benchmarks.apartment.length};
  const old=parseExisting(); const change=diff(old,data);
  const manifest={dataVersion:`3.1.${stamp()}`,generatedAt:data.metadata.extractedAt,sourceFiles,validation:{status:'PASSED',companyCount:Object.keys(data.companies).length,companyRows:Object.values(data.companies).reduce((sum,rows)=>sum+rows.length,0),krxRows:data.benchmarks.krx.length,apartmentRows:data.benchmarks.apartment.length},change};
  fs.mkdirSync(reportDir,{recursive:true}); fs.writeFileSync(path.join(reportDir,`refresh-${stamp()}.json`),JSON.stringify(manifest,null,2));
  console.log(`VALIDATION PASSED | companies: ${manifest.validation.companyCount} | company rows: ${manifest.validation.companyRows} | changed records: ${change.changedRecords}`);
  if (!apply) { console.log('DRY RUN ONLY. Run: npm run refresh:data to write the verified data package.'); process.exit(0); }
  data.metadata.dataVersion=manifest.dataVersion; data.metadata.sourceManifest='dataManifest.js';
  fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'masterData.js'),`// Generated by scripts/refresh-data.mjs. Do not edit manually.\nexport const MASTER_DATA = ${JSON.stringify(data,null,2)};\n`);
  fs.writeFileSync(path.join(outDir,'dataManifest.js'),`// Generated by scripts/refresh-data.mjs.\nexport const DATA_MANIFEST = ${JSON.stringify(manifest,null,2)};\n`);
  console.log(`DATA PACKAGE WRITTEN | ${manifest.dataVersion}`);
} catch (error) { console.error(`DATA REFRESH FAILED | ${error.message}`); process.exit(1); }
