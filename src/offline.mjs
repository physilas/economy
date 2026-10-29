import {advance} from './engine.mjs';
import {OFFLINE_LIMIT} from './data.mjs';

// Every return to the company uses the same rules, including short absences.
export function advanceOffline(game,now,onProgress){
  if(!Number.isFinite(now))return {seconds:0,skipped:0,steps:0};
  if(now<game.lastUpdate){game.lastUpdate=now;return {seconds:0,skipped:0,steps:0,clockBack:true};}
  return advance(game,now,{offline:true,onProgress});
}

// Fallback for WebViews without module workers. Yield without changing economics.
export async function advanceOfflineBatched(game,now,{onProgress,yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
  if(!Number.isFinite(now)||now<game.lastUpdate)return {game,result:advanceOffline(game,now)};
  const target=Math.min(now,game.lastUpdate+OFFLINE_LIMIT*1000),initial=game.lastUpdate,total=Math.max(1,target-initial);
  const result={seconds:0,skipped:Math.max(0,(now-target)/1000),steps:0,cash:0,wealth:0,produced:0,interest:0,dividends:0,taxes:0};
  while(game.lastUpdate+1000<=target){
    const part=advanceOffline(game,Math.min(target,game.lastUpdate+3600000));
    for(const key of Object.keys(result))if(key!=='skipped')result[key]+=part[key]||0;
    onProgress?.((game.lastUpdate-initial)/total);
    await yieldControl();
  }
  if(now>target)game.lastUpdate=now-(target-game.lastUpdate);
  return {game,result};
}
