import {safeNum} from './financialCalculators.js';

// Rolling, non-reinvested return ending at the forecast FY2026 close.
export function periodBasis(records, years) {
  if(![1,3,5,10].includes(years)) return null;
  const start=2027-years;
  const rows=[];
  for(let year=start;year<=2025;year++) {
    const matches=records.filter(r=>Number(String(r['연도']).slice(0,4))===year);
    if(matches.length!==1||safeNum(matches[0].DPS)===null) return null;
    rows.push(matches[0]);
  }
  const closing=records.filter(r=>Number(String(r['연도']).slice(0,4))===2025);
  const price=years===1?(closing.length===1?safeNum(closing[0]['기말주가']):null):safeNum(rows[0]['기초주가']);
  if(price===null||price<=0) return null;
  return {price,dividends:rows.reduce((s,r)=>s+safeNum(r.DPS),0),start,end:2026};
}
export function projectedReturn(result, dps, basis) {
  const dividend=safeNum(dps);
  return result&&basis&&dividend!==null?(result.price-basis.price+basis.dividends+dividend)/basis.price:null;
}
export function targetRequirements(result,input,basis,targetPercent) {
  const target=safeNum(targetPercent),current=projectedReturn(result,input.dps,basis);
  if(target===null||current===null) return null;
  const gap=Math.max(0,target/100-current), priceGain=gap*basis.price,capGain=priceGain*Number(input.shares);
  return {current,gap,price:result.price+priceGain,rows:[
    {name:'EBITDA',current:result.ebitda,required:result.ebitda+capGain/Number(input.multiple),unit:'억원',scale:1e8},
    {name:'Net Debt',current:result.nd,required:result.nd-capGain,unit:'억원',scale:1e8},
    {name:'EV/EBITDA',current:Number(input.multiple),required:Number(input.multiple)+capGain/result.ebitda,unit:'배',scale:1},
    {name:'DPS',current:Number(input.dps),required:Number(input.dps)+priceGain,unit:'원',scale:1}
  ]};
}
