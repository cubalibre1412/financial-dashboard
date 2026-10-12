import React, { useState } from 'react';
import '../scenario.css';
import InfoTooltip from './InfoTooltip';
import { formatPercent, formatPercentagePoints } from '../utils/financialCalculators';
import { buildScenarioBase, evaluateScenario, PROFIT_KEYS, BALANCE_KEYS, SCENARIO_SOURCE } from '../utils/tsrScenario';
import { periodBasis, projectedReturn, targetRequirements } from '../utils/scenarioTargets';

const names=['기준 전망','개선 시나리오','하방 시나리오'];
const key='pulmuone_tsr_one_screen_v3';
const num=v=>v===null||v===undefined||!Number.isFinite(v)?'—':v.toLocaleString('ko-KR',{maximumFractionDigits:2});
const money=v=>v===null||v===undefined?'—':num(v/1e8);
const numeric=e=>e.target.value===''?'':Number(e.target.value);
function NumberInput({value,onChange,label,digits=2,...props}) {
  const [focus,setFocus]=useState(false);
  return <input {...props} type="number" step="any" aria-label={label} value={value===''?'':focus?value:Number(Number(value).toFixed(digits))} onChange={onChange} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}/>;
}
export default function TsrScenario({records}) {
  const base=buildScenarioBase(records);
  const initial=()=>base?{h2:[...base.h2],balance:[...base.balance],multiple:base.latestMultiple,dps:102,shares:base.shares,ndOverride:null}:null;
  const [models,setModels]=useState(()=>names.map(initial));
  const [slot,setSlot]=useState(0),[target,setTarget]=useState(''),[years,setYears]=useState(1);
  const [notice,setNotice]=useState('');
  const [limits,setLimits]=useState({profit:'',cash:'',adjustment:0,eligible:36893263,year:2027});
  const [actions,setActions]=useState([{name:'영업이익 개선',owner:'경영기획',amount:'',date:'',status:'검토'},{name:'Net Debt 관리',owner:'자금',amount:'',date:'',status:'검토'},{name:'시장 소통',owner:'IR·PR',amount:'',date:'',status:'검토'}]);
  if(!base||models.some(m=>!m)) return <p role="status">필수 원천 데이터 부족 · 2025년 연간·2026년 반기 데이터를 확인해 주세요.</p>;
  const input=models[slot],result=evaluateScenario(base,input),baseline=evaluateScenario(base,initial());
  const basis=periodBasis(records,years),goal=targetRequirements(result,input,basis,target);
  const annual=base.actual.map((v,i)=>v+base.h2[i]);
  const update=(changes)=>setModels(prev=>prev.map((m,i)=>i===slot?{...m,...changes}:m));
  const changeAnnual=(i,value)=>update({h2:input.h2.map((v,j)=>i===j?(value===''?'':value*1e8-base.actual[i]):v)});
  const reset=()=>{update(initial());setNotice('선택 시나리오를 최신 TTM 기준으로 초기화했습니다.');};
  const save=()=>{try{localStorage.setItem(key,JSON.stringify({version:1,baseStamp:JSON.stringify(base),models,target,years,limits,actions}));setNotice('이 브라우저에 저장 완료 · 원본 데이터 변경 없음');}catch{setNotice('저장 실패 · 브라우저 저장 공간 확인 필요');}};
  const restore=()=>{try{
    const s=JSON.parse(localStorage.getItem(key));
    if(!s||s.version!==1||s.baseStamp!==JSON.stringify(base)||![1,3,5,10].includes(s.years)||!Array.isArray(s.models)||s.models.length!==3||s.models.some(m=>!evaluateScenario(base,m))||!s.limits||!Array.isArray(s.actions)) throw Error();
    setModels(s.models);setTarget(s.target);setYears(s.years);setLimits(s.limits);setActions(s.actions);setNotice('저장본 불러오기 완료');
  }catch{setNotice('불러오기 불가 · 이 화면의 저장본이 없거나 기준 데이터가 변경되었습니다. 기존 v3 저장본은 삭제하지 않았습니다.');}};
  const eligible=limits.eligible===''?null:Number(limits.eligible);
  const total=eligible!==null&&eligible>0&&input.dps!==''?Number(input.dps)*eligible:null;
  const limitReady=['profit','cash','adjustment'].every(k=>limits[k]!==''&&Number.isFinite(Number(limits[k]))&&Number(limits[k])>=0);
  const cap=limitReady?Math.max(0,Math.min(Number(limits.profit)-Number(limits.adjustment),Number(limits.cash)))*1e8:null;
  const requiredDPS=goal?.rows.find(r=>r.name==='DPS')?.required;
  const dividendWarning=cap===null||total===null?'배당 한도 미확인 · 실행안 확정 전 확인 필요':total>cap?'입력 배당 한도 초과':requiredDPS!==undefined&&requiredDPS*eligible>cap?'목표 달성용 DPS는 입력 배당 한도 초과':'입력 배당 한도 내 · 최종 승인 아님';
  const inputRows=[
    ...PROFIT_KEYS.map((k,i)=>({name:k.replace('(원)',''),unit:'억원',base:annual[i]/1e8,value:input.h2[i]===''?'':(base.actual[i]+input.h2[i])/1e8,label:'연간 '+k,change:v=>changeAnnual(i,v)})),
    {name:'Net Debt',unit:'억원',base:baseline?.nd/1e8,value:input.ndOverride===null||input.ndOverride===undefined?(input.balance[0]-input.balance[1]-input.balance[2]-input.balance[3]+input.balance[4]+input.balance[5]+input.balance[6])/1e8:input.ndOverride===''?'':input.ndOverride/1e8,label:'예상 Net Debt',change:v=>update({ndOverride:v===''?'':v*1e8})},
    {name:'EV/EBITDA',unit:'배',base:base.latestMultiple,value:input.multiple,label:'예상 Multiple',change:v=>update({multiple:v})},
    {name:'귀속 DPS',unit:'원',base:102,value:input.dps,label:'예상 DPS',change:v=>update({dps:v})},
    {name:'보통주 수',unit:'주',base:base.shares,value:input.shares,label:'예상 보통주 수',change:v=>update({shares:v})}
  ];
  const comparison=[
    {name:'예상 연말 주가',unit:'원',a:baseline?.price,b:result?.price,format:num},
    ...[1,3,5,10].map(n=>({name:n===1?'2026년 연간 TSR':n+'년 누적 TSR ('+(2027-n)+'~2026)',unit:'%',a:projectedReturn(baseline,102,periodBasis(records,n)),b:projectedReturn(result,input.dps,periodBasis(records,n)),format:formatPercent,percent:true})),
    {name:'시가총액',unit:'억원',a:baseline?.cap,b:result?.cap,format:money},
    {name:'예상 배당총액',unit:'억원',a:eligible>0?102*eligible:null,b:total,format:money}
  ];
  return <section className="scenario-v3 scenario-simple" data-testid="scenario-v3">
    <header className="scenario-heading"><div><h3>풀무원 연말 TSR 시뮬레이션</h3><span className="scenario-subtitle">2026년 말 전망 · 귀속 배당 · 비재투자</span></div><div className="scenario-tools"><label>시나리오<select aria-label="시나리오 선택" value={slot} onChange={e=>setSlot(Number(e.target.value))}>{names.map((n,i)=><option key={n} value={i}>{n}</option>)}</select></label><button onClick={reset}>초기화</button><button onClick={save}>가정 저장</button><button onClick={restore}>불러오기</button></div></header>
    <div className="scenario-targetbar"><label>목표 기간<select aria-label="목표 기간" value={years} onChange={e=>setYears(Number(e.target.value))}>{[1,3,5,10].map(n=><option key={n} value={n}>{n===1?'2026년 연간':n+'년 누적 ('+(2027-n)+'~2026)'}</option>)}</select></label><label>목표 TSR (%)<NumberInput label="목표 TSR" value={target} onChange={e=>setTarget(numeric(e))} placeholder="목표 입력"/></label><span className="scenario-assumption">입력 목표·전망은 미승인 가정</span><InfoTooltip text="모든 목표 기간은 2026년 말 종료입니다. 10년은 2017~2026년이며 경영진 요약의 과거 2016~2025년 실적과 다릅니다. 목표가 비어 있으면 달성 여부를 판정하지 않습니다. TSR=(기말 주가−기초 주가+기간 귀속 DPS 합계)÷기초 주가. 연환산 수익률이 아닙니다."/></div>
    {notice&&<p className="scenario-status" role="status">{notice}</p>}
    <div className="scenario-board">
      <section className="scenario-panel scenario-basis"><h4>① 기준 확인 <InfoTooltip text={SCENARIO_SOURCE+' 기본 DPS 102원과 배당 대상 주식수 36,893,263주는 첨부 한화면 시뮬레이션의 기준값이며 2026년 확정 배당이 아닙니다.'}/></h4>
        <table><thead><tr><th>항목</th><th>2025년 말 / 연간</th><th>2026년 말 기본 전망</th></tr></thead><tbody>
          <tr><td>EBITDA (억원)</td><td>{money(base.ebitda)}</td><td>{money(base.ttm)}</td></tr>
          <tr><td>Net Debt (억원)</td><td>{money(base.nd)}</td><td>{money(baseline?.nd)}</td></tr>
          <tr><td>EV/EBITDA (배)</td><td>{num(base.multiple)}</td><td>{num(base.latestMultiple)}</td></tr>
          <tr><td>주가 (원)</td><td>{num(base.price)}</td><td>{num(baseline?.price)}</td></tr>
          <tr><td>DPS (원)</td><td>102</td><td>102 <small>가정</small></td></tr>
        </tbody></table>
        <div className="scenario-basis-note">하반기 전년 수준 · Net Debt 반기 잔액 유지<br/>배수는 최신 TTM 기준 <strong>{num(base.latestMultiple)}배</strong></div>
        <button className="scenario-recovery" onClick={()=>{update({multiple:base.multiple});setNotice('2025년 말 배수 회복 가정 적용 · 나머지 입력 유지');}}>과거 배수 회복 가정 적용 ({num(base.multiple)}배)</button>
      </section>
      <section className="scenario-panel scenario-assumptions"><h4>② 노란 칸만 조정 <InfoTooltip text="금액은 반기 실적이 아닌 연말 예상 연간 금액입니다. EBITDA는 EBIT와 세 가지 상각비의 합계입니다. 빈칸은 0 또는 기준값으로 대체하지 않고 계산 불가로 표시합니다. Net Debt 직접 입력은 구성항목과 별도 가정이며 세부 검토에서 구분합니다."/></h4>
        <table><thead><tr><th>연말 예상값</th><th>기준</th><th>조정</th></tr></thead><tbody>{inputRows.map((r,i)=><React.Fragment key={r.name}><tr><td>{r.name} <small>({r.unit})</small></td><td>{num(r.base)}</td><td><NumberInput label={r.label} value={r.value} onChange={e=>r.change(numeric(e))} digits={r.unit==='주'?0:2}/></td></tr>{i===3&&<tr className="scenario-subtotal"><td>EBITDA (억원)</td><td>{money(baseline?.ebitda)}</td><td data-testid="scenario-ebitda">{money(result?.ebitda)}</td></tr>}</React.Fragment>)}</tbody></table>
      </section>
      <section className="scenario-panel scenario-results"><h4>③ 수정 전후 결과</h4><table><thead><tr><th>항목</th><th>기준</th><th>조정</th><th>차이</th></tr></thead><tbody>{comparison.map(r=><tr key={r.name} className={r.name==='2026년 연간 TSR'?'scenario-subtotal':''}><td>{r.name}{!r.percent&&<small> ({r.unit})</small>}</td><td>{r.a==null?'—':r.format(r.a)}</td><td>{r.b==null?'—':r.format(r.b)}</td><td>{r.a==null||r.b==null?'—':r.percent?formatPercentagePoints(r.b-r.a):r.format(r.b-r.a)}</td></tr>)}</tbody></table></section>
      <section className="scenario-panel scenario-goal"><h4>④ 목표 달성에 필요한 값 <InfoTooltip text="선택한 기간의 목표 TSR을 달성하도록 하나의 변수만 조정하는 역산입니다. 네 가지 대안을 모두 동시에 반영하지 않습니다. 목표 달성 상태이면 현재 값을 유지합니다. 음수 Net Debt는 순차입금과 구분되는 EV 조정항목의 음수 가정이며 실행 가능성은 별도 검토해야 합니다."/></h4>
        <div className="scenario-goal-kpi"><span>{years===1?'연간':years+'년 누적'} 목표 부족분</span><strong data-testid="target-gap">{goal?formatPercentagePoints(goal.gap):'목표 입력 필요'}</strong></div>
        <table><thead><tr><th>단독 조정 변수</th><th>현재</th><th>필요값</th><th>조정폭</th></tr></thead><tbody>{(goal?.rows||[{name:'EBITDA',unit:'억원'},{name:'Net Debt',unit:'억원'},{name:'EV/EBITDA',unit:'배'},{name:'DPS',unit:'원'}]).map(r=><tr key={r.name}><td>{r.name} <small>({r.unit})</small></td><td>{goal?num(r.current/r.scale):'—'}</td><td>{goal?num(r.required/r.scale):'—'}</td><td>{goal?num((r.required-r.current)/r.scale):'—'}</td></tr>)}</tbody></table>
        <p className="scenario-dividend-warning">{dividendWarning}</p>
        <small>각 행은 다른 조건 고정 · 합산 적용 금지</small>
      </section>
    </div>
    {!result&&<p role="alert">입력값 확인 필요: 빈칸, 음수 구성 잔액·DPS, 0 이하 주식수·배수·EBITDA·시가총액은 계산하지 않습니다.</p>}
    {target!==''&&!basis&&<p role="alert">선택 기간의 기초주가·귀속 DPS 원천 데이터 부족 · 목표 역산 중지</p>}
    <details><summary>시나리오 비교·TSR 기여도</summary><table><thead><tr><th>시나리오</th><th>예상 주가 (원)</th><th>연간 TSR</th><th>선택 기간 TSR</th></tr></thead><tbody>{models.map((m,i)=>{const r=evaluateScenario(base,m);return <tr key={i}><td>{names[i]}</td><td>{num(r?.price)}</td><td>{r?formatPercent(r.tsr):'—'}</td><td>{r&&basis?formatPercent(projectedReturn(r,m.dps,basis)):'—'}</td></tr>;})}</tbody></table>
      <InfoTooltip text="세 가지 시나리오는 동일한 기준에서 시작하며 사용자가 각각 조정합니다. 기여도는 2025년 말 대비 기계적 산술 분해로 인과관계를 입증하지 않습니다. EBITDA·배수 교차효과는 평균값 방식으로 배분합니다."/>
      {result&&<><div className="scenario-effects">{['EBITDA','배수','Net Debt','DPS','주식수'].map((n,i)=><div key={n}><span>{n}</span><strong>{formatPercentagePoints(i===4?result.shareEffect:result.effects[i])}</strong></div>)}</div><small>{result.valid?'합계 검산 일치':'검산 불일치 · 사용 중지'}</small></>}
    </details>
    <details><summary>Net Debt 구성항목 상세</summary><p>{input.ndOverride===null||input.ndOverride===undefined?'구성항목 합산 적용 중':'상단 Net Debt 직접 입력 적용 중 · 아래 구성항목은 참고값'}</p><button onClick={()=>update({ndOverride:null})}>구성항목 합산으로 전환</button><div className="scenario-limit-grid">{BALANCE_KEYS.map((k,i)=><label key={k}>{k.replace('(원)','')} (억원)<NumberInput label={k+' 예상'} min="0" value={input.balance[i]===''?'':input.balance[i]/1e8} onChange={e=>update({balance:input.balance.map((v,j)=>i===j?(e.target.value===''?'':Number(e.target.value)*1e8):v)})}/></label>)}</div><InfoTooltip text="순차입금=차입금−현금및현금성자산−단기금융자산−단기투자자산. Net Debt=순차입금+리스부채+신종자본증권+비지배지분. 차입금과 현금을 동일 금액 줄이면 순차입금은 변하지 않습니다."/></details>
    <details><summary>배당 한도·지급 시점 확인</summary><div className="scenario-limit-grid">{[['profit','배당가능이익 (억원)'],['cash','배당에 사용 가능한 현금 (억원)'],['adjustment','배당가능이익 감소 가정 (억원)'],['eligible','배당 대상 주식수 (주)'],['year','예상 지급연도']].map(([k,n])=><label key={k}>{n}<NumberInput label={n} min="0" value={limits[k]} onChange={e=>setLimits({...limits,[k]:numeric(e)})}/></label>)}</div><p>예상 배당총액 {money(total)}억원 · 입력 한도 {money(cap)}억원 · {dividendWarning}</p><InfoTooltip text="기본 배당 대상 주식수는 첨부 한화면 엑셀 기준입니다. 발행주식수와 다르며 별도로 변경할 수 있습니다. 한도는 사용자가 입력한 이익·현금의 최솟값을 활용한 검토값이며 법적 배당 가능액 또는 승인이 아닙니다. 2026년 귀속 배당의 2027년 현금 지급은 2026년 말 Net Debt에 자동 반영하지 않습니다."/></details>
    <details><summary>개선 과제·담당·일정</summary><table><thead><tr><th>과제</th><th>담당</th><th>효과·근거</th><th>완료 시점</th><th>상태</th></tr></thead><tbody>{actions.map((a,i)=><tr key={i}>{['name','owner','amount','date','status'].map(k=><td key={k}><input aria-label={i+1+'번 과제 '+k} value={a[k]} onChange={e=>setActions(actions.map((v,j)=>i===j?{...v,[k]:e.target.value}:v))}/></td>)}</tr>)}</tbody></table></details>
    <p className="scenario-footnote">노란 칸은 연말 예상값 · 빈칸은 계산 불가 · 저장은 현재 브라우저에만 적용 · 입력 후 ‘가정 저장’ 필요</p>
  </section>;
}
