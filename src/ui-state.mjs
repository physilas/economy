import {RESOURCES,STOCKS} from './data.mjs';

// A loaded company can have fewer discoveries than the previous company.
// Keep the visible selection and the action state on the same unlocked value.
export function normalizeUI(ui,s){
  const tier=s?.tier||0;
  const choose=(key,values,fallback)=>{if(!values.includes(ui[key]))ui[key]=fallback;};
  choose('tab',['overview','production','market','contracts','journal','statistics','more','saves','guide',...(tier>=1?['finance','research']:[]),...(s?.campaign?.unlocked?['programmes']:[])],'overview');
  choose('productionTab',['business','infra',...(tier>=1?['planner','strategy']:[])],'business');
  choose('financeTab',['bank','stocks','bonds','ventures',...(tier>=2?['properties']:[]),...(tier>=3?['hedges']:[])],'bank');
  choose('buildFilter',['all','owned','raw'],'all');
  choose('marketFilter',['all','owned','auto'],'all');
  if(!RESOURCES[ui.optionResource]||RESOURCES[ui.optionResource].tier>tier)ui.optionResource='wood';
  choose('optionType',['put','call'],'put');
  choose('optionDays',[1,3,7],3);
  choose('fixedDays',tier>=2?[10,20,60]:[10,20],20);
  choose('planStock',Object.keys(STOCKS),'sylva');
  choose('planPeriod',[1,5,10],1);
  choose('qty',[1,10,100],1);
  if(!Number.isFinite(ui.amount))ui.amount=100;
  ui.amount=Math.max(1,Math.min(1e14,Math.round(ui.amount)));
  if(!(ui.open instanceof Set))ui.open=new Set();
  return ui;
}
