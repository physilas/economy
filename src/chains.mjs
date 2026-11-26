import {BUILDINGS,RESOURCES} from './data.mjs';

const producer=resource=>Object.keys(BUILDINGS).find(id=>BUILDINGS[id].output[resource]);
const gcd=(a,b)=>b?gcd(b,a%b):a;
const fraction=(n,d=1)=>{const divisor=gcd(n,d);return [n/divisor,d/divisor];};
const add=([a,b],[c,d])=>fraction(a*d+c*b,b*d);
const multiply=([a,b],n,d=1)=>fraction(a*n,b*d);

// Aggregate shared suppliers with rational arithmetic, then reduce the entire
// blueprint to the smallest whole-number set of factories. Bonuses are kept
// out of this blueprint so the base recipe remains easy to understand.
export function chainBlueprint(s,id){
  if(!BUILDINGS[id]||BUILDINGS[id].tier>s.tier)return null;
  const counts=new Map(),edges=new Map(),depths=new Map();
  function visit(key,count,path=new Set()){
    if(path.has(key))throw new Error('Zyklische Produktionskette.');
    counts.set(key,add(counts.get(key)||[0,1],count));
    const next=new Set(path).add(key);let depth=0;
    for(const [r,q] of Object.entries(BUILDINGS[key].input)){
      const supplier=producer(r);if(!supplier||RESOURCES[r].tier>s.tier)continue;
      const needed=multiply(count,q,BUILDINGS[supplier].output[r]);
      const edgeKey=supplier+':'+key+':'+r;
      const edge=edges.get(edgeKey)||{from:supplier,to:key,resource:r,amount:[0,1]};
      edge.amount=add(edge.amount,multiply(count,q));edges.set(edgeKey,edge);
      depth=Math.max(depth,visit(supplier,needed,next)+1);
    }
    depths.set(key,depth);return depth;
  }
  visit(id,[1,1]);
  let scale=1;for(const [,denominator] of counts.values())scale=scale/gcd(scale,denominator)*denominator;
  const nodes=[...counts].map(([key,[n,d]])=>({id:key,count:n*scale/d,depth:depths.get(key)}));
  const divisor=nodes.reduce((value,node)=>gcd(value,node.count),0)||1;
  for(const node of nodes)node.count/=divisor;
  return {id,nodes:nodes.sort((a,b)=>a.depth-b.depth),edges:[...edges.values()].map(edge=>({...edge,amount:edge.amount[0]*scale/edge.amount[1]/divisor})),
    output:Object.entries(BUILDINGS[id].output).map(([resource,q])=>({resource,amount:q*nodes.find(node=>node.id===id).count}))};
}
