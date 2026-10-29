import {PROGRAMMES,PROGRAMME_CHOICES,RESOURCES} from './data.mjs';
const numeric=(n,fallback=0,max=1e100)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(max,n)):fallback;
const result=(ok,message)=>({ok,message});
export function createCampaign(age=0,peak=0){return {age,peak,unlocked:false,completed:[],active:null,bonuses:{production:0,finance:0,logistics:0}};}
export function normalizeCampaign(raw,age=0,peak=0){
  const c=createCampaign(numeric(raw?.age,age,1e12),Math.max(peak,numeric(raw?.peak)));
  if(Array.isArray(raw?.completed)){
    for(const item of raw.completed.slice(0,PROGRAMMES.length)){
      const chapter=PROGRAMMES[c.completed.length];
      if(!item||item.chapter!==chapter.id||!Object.hasOwn(PROGRAMME_CHOICES,item.choice))break;
      c.completed.push({chapter:chapter.id,choice:item.choice,at:numeric(item.at,0,c.age)});
      c.bonuses[item.choice]+=chapter.bonus[item.choice];
    }
  }
  const chapter=PROGRAMMES[c.completed.length],active=raw?.active;
  if(chapter&&active?.chapter===chapter.id&&Object.hasOwn(PROGRAMME_CHOICES,active.choice)){
    const start=numeric(active.start,c.age,c.age);c.active={chapter:chapter.id,choice:active.choice,start,end:start+chapter.duration};
  }
  c.unlocked=raw?.unlocked===true||c.completed.length>0||!!c.active;return c;
}
export function programmeOffer(s){
  const c=s.campaign,chapter=PROGRAMMES[c.completed.length];
  if(c.active||!chapter||s.tier<chapter.tier||c.peak<chapter.wealth)return null;
  return chapter;
}
export function startProgramme(s,choice){
  const chapter=programmeOffer(s);
  if(!chapter||!Object.hasOwn(PROGRAMME_CHOICES,choice))return result(false,'Dieses Holdingprogramm ist noch nicht verfügbar.');
  if(s.cash<chapter.cash||s.points<chapter.points)return result(false,'Betriebskapital oder Forschungspunkte fehlen.');
  if(Object.entries(chapter.materials).some(([id,quantity])=>s.inventory[id]+1e-7<quantity))return result(false,'Für dieses Programm fehlen noch Materialreserven.');
  s.cash-=chapter.cash;s.points-=chapter.points;
  for(const[id,quantity]of Object.entries(chapter.materials))s.inventory[id]=Math.max(0,s.inventory[id]-quantity);
  s.campaign.active={chapter:chapter.id,choice,start:s.campaign.age,end:s.campaign.age+chapter.duration};
  return result(true,'Holdingprogramm gestartet. Schwerpunkt und Investition bleiben für dieses Kapitel festgelegt.');
}
export function settleProgramme(s){
  const c=s.campaign,active=c.active;if(!active||active.end>c.age)return null;
  const chapter=PROGRAMMES[c.completed.length];
  if(chapter?.id!==active.chapter){c.active=null;return null;}
  c.completed.push({chapter:chapter.id,choice:active.choice,at:c.age});c.bonuses[active.choice]+=chapter.bonus[active.choice];c.active=null;
  s.reputation=Math.min(100,s.reputation+3);
  return `${chapter.name} abgeschlossen: ${PROGRAMME_CHOICES[active.choice].name} dauerhaft +${chapter.bonus[active.choice]} %. +3 Reputation.`;
}
export function reserveProgrammeMaterials(s,warehouseLimit){
  const chapter=programmeOffer(s);if(!chapter)return result(false,'Aktuell ist kein neues Programm verfügbar.');
  if(Object.values(chapter.materials).some(q=>q>warehouseLimit))return result(false,'Vergrößere zuerst den Lagerplatz für die benötigten Materialmengen.');
  for(const[id,quantity]of Object.entries(chapter.materials)){
    if(RESOURCES[id].tier>s.tier)return result(false,'Die benötigte Ware ist noch nicht entdeckt.');
    const a=s.automation[id];a.low=Math.max(a.low,quantity);a.high=Math.max(a.high,a.low+Math.max(10,Math.ceil(quantity*.1)));
    a.mode=a.mode==='off'||a.mode==='sell'?'both':a.mode;
  }
  return result(true,'Projektmaterialien werden automatisch bevorratet. Einkäufe nutzen die freie Betriebskasse.');
}
