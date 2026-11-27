import {controlledCompanies,company} from './corporate.mjs';
import {RESOURCES,STOCKS,BUILDINGS} from './data.mjs';

// A loaded company can have fewer discoveries than the previous company.
// Keep the visible selection and the action state on the same unlocked value.
export function normalizeUI(ui,s){
  const tier=s?.tier||0;
  const choose=(key,values,fallback)=>{if(!values.includes(ui[key]))ui[key]=fallback;};
  choose('tab',['companies','overview','production','market','contracts','journal','statistics','analysis','legacy','more','saves','guide',...(tier>=1?['finance','research']:[]),...(s?.campaign?.unlocked?['programmes']:[])],'overview');
  choose('companyId',['holding',...controlledCompanies(s?._holding||s||{}).map(c=>c.id)],'holding');
  choose('companyTab',['owned','market','contracts'],'owned');
  choose('productionTab',['business','infra','chains','planner',...(tier>=1?['strategy']:[])],'business');
  choose('financeTab',['bank','stocks','bonds','ventures',...(tier>=2?['properties']:[]),...(tier>=3?['hedges']:[])],'bank');
  choose('buildFilter',['all','owned','raw'],'all');
  choose('marketFilter',['all','auto'],'all');
  if(!RESOURCES[ui.optionResource]||RESOURCES[ui.optionResource].tier>tier)ui.optionResource='wood';
  if(!BUILDINGS[ui.chain]||BUILDINGS[ui.chain].tier>tier)ui.chain=tier>=1?'sawmill':'lumber';
  choose('optionType',['put','call'],'put');
  choose('optionDays',[1,3,7],3);
  choose('fixedDays',tier>=2?[10,20,60]:[10,20],20);
  choose('bondIssuer',['sylva','terra','ferrum','forma','nova'],'ferrum');
  choose('planStock',Object.keys(STOCKS).filter(id=>id!=='index'&&(!s?.group&&!s?._holding||company(s?._holding||s,id)?.listed)),'sylva');
  choose('planPeriod',[1,5,10],1);
  choose('qty',[1,10,100,1000,10000],1);
  choose('analysisTab',['company','production','markets','income','balance'],'company');
  choose('planMode',['actual','planned'],'actual');
  choose('analysisHours',[24,48,96],48);
  choose('bankPlanProduct',['reserve','savings','fixed'],'reserve');
  choose('bankPlanDirection',['deposit','withdraw'],'deposit');
  if(ui.bankPlanProduct==='fixed')ui.bankPlanDirection='deposit';
  if(!RESOURCES[ui.analysisResource]||RESOURCES[ui.analysisResource].tier>tier)ui.analysisResource='wood';
  if(!STOCKS[ui.analysisStock])ui.analysisStock='sylva';
  if(!Number.isFinite(ui.amount))ui.amount=100;
  ui.amount=Math.max(1,Math.min(1e14,Math.round(ui.amount)));
  if(!(ui.open instanceof Set))ui.open=new Set();
  return ui;
}
