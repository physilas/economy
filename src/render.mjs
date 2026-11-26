// Reuse keyed controls and rows so live updates retain focus, pressed buttons,
// overflow positions and browser scroll anchors instead of rebuilding the page.
export function nodeKey(node){
  if(node.nodeType!==1)return null;
  const attr=name=>node.getAttribute(name);
  if(attr('data-key'))return node.nodeName+':key:'+attr('data-key');
  if(attr('id'))return node.nodeName+':id:'+attr('id');
  if(attr('data-action'))return [node.nodeName,'action',attr('data-action'),attr('data-id')||'',attr('data-side')||'',attr('data-field')||'',attr('data-delta')||''].join(':');
  return null;
}

export function morph(oldNode,newNode){
  if(oldNode.nodeType!==newNode.nodeType||oldNode.nodeName!==newNode.nodeName){oldNode.replaceWith(newNode.cloneNode(true));return;}
  if(oldNode.nodeType===3){if(oldNode.data!==newNode.data)oldNode.data=newNode.data;return;}
  if(oldNode.nodeType!==1)return;
  const doc=oldNode.ownerDocument;
  if(oldNode===doc.activeElement&&['INPUT','SELECT','TEXTAREA'].includes(oldNode.tagName))return;
  if(oldNode.hasAttribute('data-preserve-text')&&oldNode.textContent)return;
  const preserveOpen=oldNode.tagName==='DETAILS'&&oldNode.hasAttribute('data-preserve-open');
  for(const {name}of [...oldNode.attributes])if(!(preserveOpen&&name==='open')&&!newNode.hasAttribute(name))oldNode.removeAttribute(name);
  for(const {name,value}of newNode.attributes)if(!(preserveOpen&&name==='open')&&oldNode.getAttribute(name)!==value)oldNode.setAttribute(name,value);
  const oldChildren=[...oldNode.childNodes],used=new Set();
  const keyed=new Map(oldChildren.map(node=>[nodeKey(node),node]).filter(([key])=>key!==null));
  let cursor=oldNode.firstChild;
  for(const desired of [...newNode.childNodes]){
    const key=nodeKey(desired);
    let current=key!==null?keyed.get(key):oldChildren.find(node=>!used.has(node)&&nodeKey(node)===null&&node.nodeType===desired.nodeType&&node.nodeName===desired.nodeName);
    if(used.has(current))current=null;
    if(current){used.add(current);if(current!==cursor)oldNode.insertBefore(current,cursor);morph(current,desired);}
    else{current=desired.cloneNode(true);oldNode.insertBefore(current,cursor);}
    cursor=current.nextSibling;
  }
  for(const child of oldChildren)if(!used.has(child)&&child.parentNode===oldNode)child.remove();
}

export function patchView(root,html){
  const doc=root.ownerDocument,win=doc.defaultView;
  const x=win.scrollX,y=win.scrollY;
  const scrollers=[...root.querySelectorAll('*')].filter(node=>node.scrollLeft||node.scrollTop).map(node=>[node,node.scrollLeft,node.scrollTop]);
  const template=doc.createElement('template');template.innerHTML=html;
  const shell=root.cloneNode(false);shell.append(...template.content.childNodes);morph(root,shell);
  for(const[node,left,top]of scrollers)if(node.isConnected){if(node.scrollLeft!==left)node.scrollLeft=left;if(node.scrollTop!==top)node.scrollTop=top;}
  if(win.scrollX!==x||win.scrollY!==y)win.scrollTo({left:x,top:y,behavior:'instant'});
}
