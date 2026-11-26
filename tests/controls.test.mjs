import test from 'node:test';
import assert from 'node:assert/strict';
import {installHoldControls,lockZoom} from '../src/controls.mjs';

function harness(){
  const handlers=new Map(),pending=new Map();let sequence=0;
  const timers={setTimeout(callback){pending.set(++sequence,callback);return sequence;},clearTimeout(id){pending.delete(id);}};
  const root={nodes:[],addEventListener(type,callback){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(callback);},querySelectorAll(){return this.nodes;}};
  const button=(action='trade')=>({dataset:{action,id:'wood',side:'buy'},disabled:false,isConnected:true,closest(){return this;}});
  const emit=(type,node,extra={})=>{const event={target:node,button:0,pointerId:1,isPrimary:true,clientX:10,clientY:10,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const handler of handlers.get(type)||[]){handler(event);if(event.stopped)break;}return event;};
  const runTimer=async()=>{const [id,callback]=pending.entries().next().value||[];if(callback){pending.delete(id);await callback();}};
  return {root,button,emit,timers,pending,runTimer};
}

test('held step buttons re-resolve live controls, repeat and stop immediately on release',async()=>{
  const h=harness(),first=h.button();h.root.nodes=[first];let calls=0,starts=0,ends=0;
  installHoldControls(h.root,{timers:h.timers,invoke:()=>{calls++;},onStart:()=>starts++,onEnd:()=>ends++});
  h.emit('pointerdown',first);assert.equal(calls,0);await h.runTimer();assert.equal(calls,1);assert.equal(starts,1);
  const replacement=h.button();h.root.nodes=[replacement];await h.runTimer();assert.equal(calls,2);
  h.emit('pointerup',replacement);assert.equal(h.pending.size,0);assert.equal(ends,1);await h.runTimer();assert.equal(calls,2);
  const click=h.emit('click',replacement);assert.equal(click.prevented,true);assert.equal(click.stopped,true);
});

test('normal taps retain their click and disabled, vanished or scrolled controls cannot keep repeating',async()=>{
  for(const stop of ['scroll','pointercancel','lostpointercapture','visibilitychange']){
    const h=harness(),button=h.button();h.root.nodes=[button];let calls=0;installHoldControls(h.root,{timers:h.timers,invoke:()=>calls++});
    h.emit('pointerdown',button);h.emit(stop,button);await h.runTimer();assert.equal(calls,0,stop);assert.ok(!h.emit('click',button).prevented);
  }
  for(const invalid of ['disabled','missing']){
    const h=harness(),button=h.button();h.root.nodes=[button];let calls=0;installHoldControls(h.root,{timers:h.timers,invoke:()=>calls++});
    h.emit('pointerdown',button);await h.runTimer();if(invalid==='disabled')button.disabled=true;else h.root.nodes=[];
    await h.runTimer();assert.equal(calls,1);assert.equal(h.pending.size,0);
  }
});

test('moving off a held button stops further purchases',async()=>{
  const h=harness(),button=h.button();h.root.nodes=[button];let calls=0;
  installHoldControls(h.root,{timers:h.timers,invoke:()=>calls++});h.emit('pointerdown',button);await h.runTimer();
  h.emit('pointermove',{closest:()=>null},{clientX:50});await h.runTimer();assert.equal(calls,1);assert.equal(h.pending.size,0);
});

test('zoom lock cancels pinch and zoom shortcuts while allowing ordinary scrolling and typing',()=>{
  const h=harness(),node={};lockZoom(h.root);
  assert.equal(h.emit('gesturestart',node).prevented,true);
  assert.equal(h.emit('touchmove',node,{touches:[{},{}]}).prevented,true);
  assert.ok(!h.emit('touchmove',node,{touches:[{}]}).prevented);
  assert.equal(h.emit('wheel',node,{ctrlKey:true}).prevented,true);assert.ok(!h.emit('wheel',node).prevented);
  assert.equal(h.emit('keydown',node,{metaKey:true,key:'-'}).prevented,true);assert.ok(!h.emit('keydown',node,{key:'-'}).prevented);
});
