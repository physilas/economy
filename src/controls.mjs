// A held button repeats after a short delay. Every repetition resolves the live
// button again so morphing, disabled states and navigation cannot leave a stale
// action running. Scrolling, leaving the button or hiding the app cancels it.
export function installHoldControls(root,{invoke,onEnd=()=>{},onStart=()=>{},timers=globalThis}={}){
  let held=null,timer=null,started=false,busy=false,suppressUntil=0,suppressed=null;
  const key=node=>node?[node.dataset.action,node.dataset.id||'',node.dataset.side||'',node.dataset.delta||'',node.dataset.field||''].join('|'):'';
  const stop=()=>{
    if(timer!==null)timers.clearTimeout(timer);timer=null;
    if(held&&started){suppressUntil=Date.now()+800;suppressed=held.key;onEnd();}
    held=null;started=false;
  };
  async function tick(){
    if(!held||busy)return;
    const current=[...root.querySelectorAll('button[data-repeat]')].find(node=>key(node)===held.key);
    if(!current||current.disabled||!current.isConnected){stop();return;}
    if(!started){started=true;onStart();}
    busy=true;
    try{await invoke(current);}finally{busy=false;}
    if(held)timer=timers.setTimeout(tick,120);
  }
  root.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.isPrimary===false)return;
    stop();const node=event.target.closest?.('button[data-repeat]');if(!node||node.disabled)return;
    held={key:key(node),pointer:event.pointerId,x:event.clientX,y:event.clientY};timer=timers.setTimeout(tick,350);
  });
  root.addEventListener('pointermove',event=>{
    if(!held||event.pointerId!==held.pointer)return;
    const node=event.target.closest?.('button[data-repeat]');
    if(key(node)!==held.key||Math.hypot(event.clientX-held.x,event.clientY-held.y)>12)stop();
  },{passive:true});
  for(const name of ['pointerup','pointercancel','lostpointercapture','visibilitychange','scroll'])root.addEventListener(name,stop,{passive:true,capture:true});
  root.addEventListener('contextmenu',event=>{if(event.target.closest?.('button[data-repeat]'))event.preventDefault();});
  root.addEventListener('click',event=>{
    const button=event.target.closest?.('button[data-repeat]');
    if(button&&Date.now()<suppressUntil&&key(button)===suppressed){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  return stop;
}

export function lockZoom(root){
  for(const type of ['gesturestart','gesturechange','gestureend'])root.addEventListener(type,event=>event.preventDefault(),{passive:false});
  for(const type of ['touchstart','touchmove'])root.addEventListener(type,event=>{if(event.touches.length>1)event.preventDefault();},{passive:false});
  root.addEventListener('wheel',event=>{if(event.ctrlKey||event.metaKey)event.preventDefault();},{passive:false});
  root.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&['+','-','=','0','NumpadAdd','NumpadSubtract'].includes(event.key))event.preventDefault();});
  root.addEventListener('dblclick',event=>event.preventDefault());
}
