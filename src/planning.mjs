import {BUILDINGS,INFRA,POLICIES,HOUR} from './data.mjs';
import {buildQuote,capacity,feeRate,price,quote,productionBonus,supplyPlan,infrastructureYield} from './engine.mjs';

const positiveCeil=value=>Math.ceil(Math.max(0,value-1e-9));
const finiteCost=value=>Number.isFinite(value)?value:null;
const technicalUtilization=c=>Math.min(c.staffing,c.energy?c.potentialEnergy/c.energy:1,c.logistics,1)*c.environment;
function coalDemand(s,c){
  const maximum=s.infra.power*infrastructureYield(s,'power','energy');
  return maximum?s.infra.power*4*Math.min(1,Math.max(0,c.energy-c.cleanEnergy)/maximum):0;
}
function infrastructureOption(s,id,shortage,perUnit){
  if(INFRA[id].tier>s.tier)return null;
  const quantity=positiveCeil(shortage/perUnit),d=INFRA[id],existing=s.infra[id];
  const buildingCost=d.cost*Math.pow(d.growth,existing)*(Math.pow(d.growth,quantity)-1)/(d.growth-1);
  const materialCost=Object.entries(d.materials||{}).reduce((total,[resource,amount])=>{
    const missing=Math.max(0,amount*quantity-s.inventory[resource]);return total+(missing>1e8?Infinity:quote(s,resource,missing).total);
  },0);
  const cost=quantity<=100?buildQuote(s,id,quantity,true).total:buildingCost+materialCost;
  return {id,quantity,cost:finiteCost(cost),withinLimit:quantity+existing<=10000};
}

// Current-price analysis only: no random numbers, future market information or game mutations.
export function previewBuilding(s,id,quantity=1){
  if(!Object.hasOwn(BUILDINGS,id)||BUILDINGS[id].tier>s.tier||!Number.isInteger(quantity)||quantity<1||quantity>100)return null;
  const b=BUILDINGS[id],owned=s.buildings[id],quote=buildQuote(s,id,quantity);
  const planned={...s,buildings:{...s.buildings,[id]:{...owned,count:owned.count+quantity,active:owned.active+quantity}},inventory:{...s.inventory}};
  const materials=Object.entries(quote.materials).map(([resource,needed])=>{
    const used=Math.min(needed,s.inventory[resource]);planned.inventory[resource]-=used;
    return {id:resource,needed,fromStock:used,purchased:needed-used};
  });
  const before=capacity(s),after=capacity(planned),beforeUse=technicalUtilization(before),afterUse=technicalUtilization(after);
  const multiplier=productionBonus(s,id),scale=quantity*multiplier,fee=feeRate(s)+.008;
  const inputs=Object.entries(b.input).map(([resource,value])=>({id:resource,quantity:value*scale}));
  const outputs=Object.entries(b.output).map(([resource,value])=>({id:resource,quantity:value*scale}));
  const wages=quantity*b.wage*(1+owned.level*.08)*POLICIES[s.policy].wage;
  const inputCost=inputs.reduce((total,r)=>total+r.quantity*price(s,r.id)*(1+fee),0);
  const outputValue=outputs.reduce((total,r)=>total+r.quantity*price(s,r.id)*(1-fee),0);
  const extraCoal=Math.max(0,coalDemand(planned,after)-coalDemand(s,before));
  const fuelCost=extraCoal*price(s,'coal')*(1+fee),ecoCost=Math.max(0,after.ecoCost-before.ecoCost);
  const tradeMargin=outputValue-inputCost-wages,guarded=s.profitGuard&&tradeMargin<0;
  const fullMargin=tradeMargin-fuelCost-ecoCost;
  const capacityMargin=(guarded?0:tradeMargin*afterUse)-fuelCost-ecoCost;
  const deficits=[];
  const staffShortage=Math.max(0,after.staff-after.workers),energyShortage=Math.max(0,after.energy-after.potentialEnergy),transportShortage=Math.max(0,after.freight-after.transport);
  for(const[metric,shortage,provided]of [['staff',staffShortage,'workers'],['energy',energyShortage,'energy'],['freight',transportShortage,'transport']]){
    if(shortage>1e-9)deficits.push({metric,shortage,options:Object.keys(INFRA).filter(key=>INFRA[key].provides?.[provided]).map(key=>infrastructureOption(s,key,shortage,infrastructureYield(s,key,provided))).filter(Boolean)});
  }
  const previousDeficits={staff:Math.max(0,before.staff-before.workers),energy:Math.max(0,before.energy-before.potentialEnergy),freight:Math.max(0,before.freight-before.transport)};
  for(const deficit of deficits)deficit.additionalShortage=Math.max(0,deficit.shortage-previousDeficits[deficit.metric]);
  const flows=new Map(supplyPlan(planned).map(r=>[r.id,r]));
  const required=new Map(inputs.map(r=>[r.id,r.quantity]));
  if(extraCoal>0)required.set('coal',(required.get('coal')||0)+extraCoal);
  const supplies=[...required].map(([resource,needed])=>{
    const flow=flows.get(resource)||{input:0,output:0,producers:[]};
    const consumption=resource==='coal'?flow.input-planned.infra.power*4+coalDemand(planned,after):flow.input;
    const gap=Math.max(0,consumption-flow.output),producer=flow.producers[0];
    const yieldPerUnit=producer?BUILDINGS[producer].output[resource]*productionBonus(s,producer):0;
    return {id:resource,needed,stock:planned.inventory[resource],companyDemand:consumption,companyOutput:flow.output,gap,
      coverageHours:gap>0?planned.inventory[resource]/gap:null,producer:producer||null,additionalProducers:yieldPerUnit?positiveCeil(gap/yieldPerUnit):null};
  });
  const total=finiteCost(quote.total),cashAfter=total===null?0:Math.max(0,s.cash-total),withinLimit=owned.count+quantity<=10000;
  const reserveNeeded=2*(wages+inputCost+fuelCost+ecoCost);
  return {id,quantity,multiplier,cost:total,buildingCost:finiteCost(quote.cash),materialCost:finiteCost(quote.materialCash),materials,
    affordable:total!==null&&total<=s.cash+1e-7&&withinLimit,withinLimit,cashAfter,missingCash:total===null?null:Math.max(0,total-s.cash),
    inputs,outputs,supplies,wages,inputCost,outputValue,fuelCost,ecoCost,fullMargin,capacityMargin,guarded,
    utilizationBefore:beforeUse,utilizationAfter:afterUse,
    affectsExisting:Object.values(s.buildings).some(r=>r.active>0)&&afterUse<beforeUse-1e-9,
    capacity:{staff:{used:after.staff,available:after.workers},energy:{used:after.energy,available:after.potentialEnergy,availableNow:after.availableEnergy},freight:{used:after.freight,available:after.transport}},
    deficits,reserveNeeded,lowReserve:total!==null&&total<=s.cash&&cashAfter<reserveNeeded,
    paybackSeconds:capacityMargin>0&&total!==null?total/capacityMargin*HOUR:null,
  };
}
