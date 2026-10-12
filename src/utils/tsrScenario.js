import { safeNum, getMarketCap, getNetDebtBroad } from './financialCalculators.js';

export const H1_2025 = [30823784645, 81225903000, 914284000, 4291439000];
export const PROFIT_KEYS = ['EBIT(원)', '감가상각비(원)', '투자부동산감가상각비(원)', '무형자산상각비(원)'];
export const BALANCE_KEYS = ['차입금(원)', '현금 및 현금성 자산(원)', '단기금융자산(원)', '단기투자자산(원)', '리스부채(원)', '신종자본증권(원)', '비지배지분(원)'];
export const SCENARIO_SOURCE = '2025년 연간: 전체 데이터 시트. 2025H1 비교 실적: 풀무원 반기보고서(2026.08.14) PDF 46·107쪽, 상각비 천원→원 환산. 하반기=연간−상반기. 2026H1 실제는 현재 불러온 데이터. 하반기 기본값은 전년 수준 유지 가정이며 회사 전망 아님.';
export function buildScenarioBase(records) {
  const fy=records.find(r=>String(r['연도']).startsWith('2025'));
  const h1=records.find(r=>String(r['연도']).startsWith('2026'));
  if(!fy||!h1) return null;
  const prior=PROFIT_KEYS.map(k=>safeNum(fy[k]));
  const actual=PROFIT_KEYS.map(k=>safeNum(h1[k]));
  const balance=BALANCE_KEYS.map(k=>safeNum(h1[k]));
  const price=safeNum(fy['기말주가']),cap=getMarketCap(fy),nd=getNetDebtBroad(fy);
  if([...prior,...actual,...balance,price,cap,nd].some(v=>v===null)||price<=0||cap<=0) return null;
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const h2=prior.map((v,i)=>v-H1_2025[i]);
  const ebitda=sum(prior);
  if(ebitda<=0) return null;
  const ttm=sum(actual)+sum(h2), latestCap=getMarketCap(h1), latestND=getNetDebtBroad(h1);
  if(ttm<=0||latestCap===null||latestND===null) return null;
  return {price,cap,nd,ebitda,multiple:(cap+nd)/ebitda,latestMultiple:(latestCap+latestND)/ttm,shares:cap/price,h2,actual,balance,ttm};
}
export function evaluateScenario(base, input) {
  const h2=input.h2.map(safeNum),balance=input.balance.map(safeNum);
  const multiple=safeNum(input.multiple),dps=safeNum(input.dps),shares=safeNum(input.shares);
  if(!base||[...h2,...balance,multiple,dps,shares].some(v=>v===null)||shares<=0||multiple<=0||dps<0||balance.some(v=>v<0)) return null;
  const ebitda=base.actual.reduce((a,b)=>a+b,0)+h2.reduce((a,b)=>a+b,0);
  if(ebitda<=0) return null;
  const nb=balance[0]-balance[1]-balance[2]-balance[3];
  const nd=input.ndOverride===undefined||input.ndOverride===null?nb+balance[4]+balance[5]+balance[6]:safeNum(input.ndOverride);
  if(nd===null) return null;
  const ev=ebitda*multiple, cap=ev-nd, price=cap/shares;
  if(cap<=0) return null;
  const tsr=(price-base.price+dps)/base.price;
  const effects=[(ebitda-base.ebitda)*(multiple+base.multiple)/2/base.cap,
    (multiple-base.multiple)*(ebitda+base.ebitda)/2/base.cap,-(nd-base.nd)/base.cap,dps/base.price];
  // Share-count change is separate from the four constant-share effects.
  const shareEffect=(cap/shares-cap/base.shares)/base.price;
  const residual=tsr-effects.reduce((a,b)=>a+b,0)-shareEffect;
  return {ebitda,nb,nd,ev,cap,price,tsr,effects,shareEffect,residual,valid:Math.abs(residual)<1e-10};
}
export function sensitivity(base, input, desiredPP=1) {
  const current=evaluateScenario(base,input);
  if(!current) return null;
  const denom=Number(input.shares)*base.price, m=Number(input.multiple),e=current.ebitda;
  const desired=Number(desiredPP)/100;
  return [
    {name:'EBITDA',unit:'100억원 증가',effect:1e10*m/denom,required:desired*denom/m,kind:'억원'},
    {name:'Multiple',unit:'0.1배 상승',effect:e*0.1/denom,required:desired*denom/e,kind:'배'},
    {name:'Net Debt',unit:'100억원 감소',effect:1e10/denom,required:desired*denom,kind:'억원 감소'},
    {name:'DPS',unit:'100원 증가',effect:100/base.price,required:desired*base.price,kind:'원 증가'}
  ];
}
