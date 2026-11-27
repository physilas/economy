import {RETIRED_PROGRAMMES} from './campaign.mjs';
import {BUILDINGS,RESOURCES,INFRA} from './data.mjs';
const OLD_PRICES={"wood": 6.0, "stone": 8.0, "grain": 5.0, "water": 3.0, "coal": 12.0, "ore": 16.0, "cotton": 9.0, "planks": 22.0, "bricks": 28.0, "food": 19.0, "iron": 55.0, "fabric": 35.0, "glass": 42.0, "tools": 115.0, "steel": 155.0, "furniture": 125.0, "chemicals": 110.0, "machines": 680.0, "medicine": 290.0, "electronics": 520.0, "vehicles": 3300.0, "chips": 1850.0, "satellites": 18000.0, "polymers": 800.0, "alloys": 3200.0, "robots": 9000.0, "cells": 32000.0, "quantum": 65000.0, "biotech": 24000.0, "nano": 120000.0, "climate": 400000.0, "starships": 3000000.0, "habitats": 6000000.0, "biospheres": 18000000.0, "knowledge": 24000000.0, "colonies": 120000000.0};
// Removed content is converted to cash once; migrated saves carry a revision.
export function migrateEconomy(raw){
  if(raw?.economyRevision>=3)return raw;
  const s=structuredClone(raw);let compensation=0;
  for(const[id,b]of Object.entries(s.buildings||{}))if(!Object.hasOwn(BUILDINGS,id))compensation+=Math.max(0,Number.isFinite(b?.book)?b.book:0);
  for(const[id,quantity]of Object.entries(s.inventory||{}))if(!Object.hasOwn(RESOURCES,id)){
    const m=s.market?.[id],factor=Number.isFinite(m?.factor)?Math.max(.45,Math.min(2.1,m.factor)):1,pressure=Number.isFinite(m?.pressure)?Math.max(-1.5,Math.min(1.5,m.pressure)):0;
    compensation+=Math.max(0,Number.isFinite(quantity)?quantity:0)*(OLD_PRICES[id]||0)*factor*Math.exp(pressure)*.98;
  }
  for(const[id,value]of Object.entries(s.infraBook||{}))if(!Object.hasOwn(INFRA,id))compensation+=Math.max(0,Number.isFinite(value)?value:0);
  for(const o of s.options||[])if(o&&!Object.hasOwn(RESOURCES,o.resource))compensation+=Math.max(0,Number.isFinite(o.premium)?o.premium:0);
  const removedResearch={computing:{money:180000,points:350,max:8},systems:{money:8000000,points:14000,max:5},science:{money:40000000,points:18000,max:5}};
  for(const[id,d]of Object.entries(removedResearch)){const level=Math.max(0,Math.min(d.max,Number.isFinite(s.research?.[id])?s.research[id]:0));for(let i=0;i<level;i++){compensation+=d.money*2.2**i;s.points=Math.min(1e100,Math.max(0,Number.isFinite(s.points)?s.points:0)+Math.round(d.points*1.75**i));}}
  if(s.campaign&&typeof s.campaign==='object'){
    const ids=['identity','reliability','borders',...Object.keys(RETIRED_PROGRAMMES)],completed=Array.isArray(s.campaign.completed)?s.campaign.completed:[],retired=[];
    for(let i=0;i<Math.min(ids.length,completed.length);i++){const item=completed[i];if(!item||item.chapter!==ids[i]||!['production','finance','logistics'].includes(item.choice))break;if(i>=3)retired.push({chapter:item.chapter,choice:item.choice});}
    const active=s.campaign.active;if(active&&Object.hasOwn(RETIRED_PROGRAMMES,active.chapter)&&active.chapter===ids[completed.length]&&['production','finance','logistics'].includes(active.choice)){retired.push({chapter:active.chapter,choice:active.choice});s.campaign.active=null;}
    s.campaign.retired=retired;
  }
  s.cash=Math.min(1e100,Math.max(0,Number.isFinite(s.cash)?s.cash:0)+compensation);s.economyRevision=3;
  if(compensation>0){s.journal=Array.isArray(s.journal)?s.journal:[];s.journal.unshift({id:Math.max(1,s.nextId||1),at:s.elapsed||0,type:'finance',text:`Umstellung auf vier Wirtschaftsketten: ${Math.round(compensation).toLocaleString('de-DE')} € für entfallene Anlagen, Waren, Forschungszweige und Absicherungen gutgeschrieben.`});s.nextId=Math.max(1,s.nextId||1)+1;}
  return s;
}
