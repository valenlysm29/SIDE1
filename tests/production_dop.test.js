'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dop=require('../production_dop'),model=require('../production_model');
const box=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height});
function layout(mobile=false){
  if(mobile)return Object.fromEntries(['leather','cut','accessories','classification','preparation','assembly','finish','result'].map((id,i)=>[id,box(32,i*176,220,144)]));
  return {accessories:box(0,0,320,140),leather:box(400,0,320,140),classification:box(0,172,320,180),cut:box(400,172,320,180),preparation:box(0,384,320,210),assembly:box(400,384,320,210),finish:box(400,626,320,160),result:box(0,818,720,200)};
}
function points(route){
  const tokens=route.d.split(' '),out=[];let x,y;
  for(let i=0;i<tokens.length;){const op=tokens[i++];if(op==='M'){x=Number(tokens[i++]);y=Number(tokens[i++]);}else if(op==='H')x=Number(tokens[i++]);else if(op==='V')y=Number(tokens[i++]);else throw Error(op);out.push({x,y});}
  return out;
}
function onBorder(p,b){return ((p.x===b.left||p.x===b.right)&&p.y>=b.top&&p.y<=b.bottom)||((p.y===b.top||p.y===b.bottom)&&p.x>=b.left&&p.x<=b.right);}
function intersectsInterior(a,b,r){
  if(a.x===b.x)return a.x>r.left&&a.x<r.right&&Math.max(a.y,b.y)>r.top&&Math.min(a.y,b.y)<r.bottom;
  return a.y>r.top&&a.y<r.bottom&&Math.max(a.x,b.x)>r.left&&Math.min(a.x,b.x)<r.right;
}
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} wires touch the intended borders and cross no cards`,()=>{
  const boxes=layout(mobile),routes=dop.routes(boxes,{stacked:mobile,rail:16});
  assert.equal(routes.length,7);
  for(const route of routes){
    assert.ok(onBorder(route.start,boxes[route.from]),`${route.from} start`);
    assert.ok(onBorder(route.end,boxes[route.to]),`${route.to} end`);
    const pts=points(route);
    assert.deepEqual(pts[0],route.start);assert.deepEqual(pts.at(-1),route.end);
    for(let i=1;i<pts.length;i++)for(const [id,b] of Object.entries(boxes))assert.equal(intersectsInterior(pts[i-1],pts[i],b),false,`${route.from}→${route.to} intersects ${id}`);
    assert.doesNotMatch(route.d,/NaN|Infinity|undefined/);
  }
});
test('connector coordinates follow changed card widths and heights instead of fixed viewport positions',()=>{
  const boxes=layout(),original=dop.routes(boxes);
  const scaled=Object.fromEntries(Object.entries(boxes).map(([id,b])=>[id,Object.fromEntries(Object.entries(b).map(([k,v])=>[k,v*1.4]))]));
  const resized=dop.routes(scaled);
  for(let i=0;i<original.length;i++)for(const point of ['start','end'])for(const axis of ['x','y'])assert.ok(Math.abs(resized[i][point][axis]-original[i][point][axis]*1.4)<1e-9);
  assert.deepEqual(dop.routes({}),[]);
});
test('rendering an empty plan preserves inputs and shows zero output, percent and mold detail',()=>{
  const plan=model.calculate(),before=JSON.stringify(plan),html=dop.render(plan,{round:3,producedPercent:0});
  assert.equal(JSON.stringify(plan),before);
  assert.match(html,/<strong>0%<\/strong>/);assert.match(html,/0 unidades totales/);
  assert.match(html,/PRODUCCIÓN FINAL DEL CICLO 3/);
  for(const mold of ['Molde básico','Molde mejorado','Molde premium'])assert.ok(html.includes(mold));
  assert.equal((html.match(/data-pd-node=/g)||[]).length,8);
  assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});
test('material labels are escaped and percentages are supplied by the existing app calculation',()=>{
  const plan=model.calculate();plan.materials[0].selections=[{label:'<img src=x onerror=alert(1)>'}];
  const html=dop.render(plan,{round:1,producedPercent:37});
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<img/);
  assert.match(html,/<strong>37%<\/strong>/);
});
test('mount redraws after resize and disconnects observers when the category changes',()=>{
  let callback,frame=null,resizeHandler,disconnected=false,cancelled=false;
  const boxes=layout();
  const nodes=Object.entries(boxes).map(([id,b])=>({dataset:{pdNode:id},getBoundingClientRect:()=>b}));
  const svg={attrs:{},innerHTML:'',setAttribute(k,v){this.attrs[k]=v}};
  const graph={isConnected:true,querySelector:()=>svg,querySelectorAll:()=>nodes,getBoundingClientRect:()=>({left:0,top:0,width:720,height:1018})};
  const ctx=vm.createContext({requestAnimationFrame(fn){frame=fn;return 1},cancelAnimationFrame(){frame=null;cancelled=true},getComputedStyle(){return {getPropertyValue:()=> '0'}},
    ResizeObserver:class{constructor(fn){callback=fn}observe(){}disconnect(){disconnected=true}},window:{addEventListener(event,fn){resizeHandler=fn},removeEventListener(event,fn){assert.equal(fn,resizeHandler);resizeHandler=null}},document:{}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../production_dop.js'),'utf8'),ctx);
  const cleanup=ctx.SIDE_PRODUCTION_DOP.mount({querySelector:()=>graph});
  frame();assert.equal((svg.innerHTML.match(/<path /g)||[]).length,7);
  assert.equal(svg.attrs.viewBox,'0 0 720 1018');
  boxes.result.bottom+=40;callback();assert.equal(typeof frame,'function');frame();
  resizeHandler();cleanup();assert.ok(disconnected);assert.ok(cancelled);assert.equal(resizeHandler,null);
  frame=null;callback();assert.equal(frame,null);
});
