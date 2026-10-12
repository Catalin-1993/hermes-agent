/**
 * Starting points for an interactive block: small, complete web pages that follow the app's theme
 * (`--hermes-*`), keep what the user does with `hermes.save`, run with no network and ask nothing of
 * the page beyond the `hermes` object. Each is an ordinary document — once placed, it is the user's (or
 * Hermes's) to edit. Their words are in English; "Ask Hermes to change it" translates or reshapes any.
 */

import { doc, type InteractiveTemplate } from './interactive-template-base'
import { WORK_TEMPLATES } from './interactive-templates-work'

export type { InteractiveTemplate, InteractiveTemplateId } from './interactive-template-base'

const roi = doc(
  'ROI calculator',
  `.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0 14px}
.out{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:18px}
.out .card .k{color:var(--hermes-muted);font-size:.8125rem}.out .card .v{font-size:1.375rem;font-weight:650}`,
  `<h2>ROI calculator</h2>
<p class="sub">What an investment returns, and how soon it pays back.</p>
<div class="grid">
  <div><label for="cost">Investment</label><input id="cost" type="number" min="0" step="any"></div>
  <div><label for="gain">Return per month</label><input id="gain" type="number" min="0" step="any"></div>
  <div><label for="months">Period (months)</label><input id="months" type="number" min="1" step="1"></div>
</div>
<div class="out">
  <div class="card"><div class="k">ROI</div><div class="big" id="roi" aria-live="polite">–</div></div>
  <div class="card"><div class="k">Net gain</div><div class="v" id="net">–</div></div>
  <div class="card"><div class="k">Payback</div><div class="v" id="payback">–</div></div>
</div>`,
  `var s=Object.assign({cost:12000,gain:1500,months:12},hermes.state||{});
var f=new Intl.NumberFormat(undefined,{maximumFractionDigits:0});
['cost','gain','months'].forEach(function(id){var el=document.getElementById(id);el.value=s[id];el.addEventListener('input',function(){s[id]=parseFloat(el.value)||0;hermes.save(s);show()})});
function show(){var c=s.cost,g=s.gain,m=s.months,total=g*m,net=total-c;
document.getElementById('roi').textContent=c>0?(net/c*100).toFixed(0)+'%':'–';
document.getElementById('net').textContent=f.format(net);
document.getElementById('payback').textContent=g>0&&c>0?(c/g).toFixed(1)+' months':'–'}
show()`
)

const quiz = doc(
  'Quiz',
  `.bar{height:6px;border-radius:99px;background:var(--hermes-border);overflow:hidden;margin:6px 0 18px}
.bar i{display:block;height:100%;background:var(--hermes-accent);transition:width .25s}
.q{font-size:1.0625rem;font-weight:600;margin:0 0 12px}
.opts{display:grid;gap:8px}.opts button{text-align:left;padding:10px 12px}
.opts button.ok{border-color:#16a34a;background:rgba(22,163,74,.14)}.opts button.no{border-color:#dc2626;background:rgba(220,38,38,.12)}
.note{min-height:1.4em;margin:12px 0 0;font-size:.875rem}`,
  `<h2>Quiz</h2>
<p class="sub" id="meta"></p>
<div class="bar" aria-hidden="true"><i id="fill"></i></div>
<div id="stage"></div>`,
  `var QUESTIONS=[
 {q:'Which HTML element holds the main navigation links?',a:['<nav>','<aside>','<section>','<menu>'],c:0},
 {q:'Which CSS property controls the space between flex items?',a:['margin-flow','gap','spacing','pad-between'],c:1},
 {q:'What does JSON stand for?',a:['JavaScript Object Notation','Java Standard Output Name','JavaScript Online Network','Joined Syntax Object Node'],c:0},
 {q:'Which method adds an item to the end of an array?',a:['unshift','push','append','add'],c:1}
];
var s=Object.assign({i:0,score:0,best:0,picked:null},hermes.state||{});
var stage=document.getElementById('stage'),meta=document.getElementById('meta'),fill=document.getElementById('fill');
function save(){hermes.save(s)}
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function render(){stage.textContent='';fill.style.width=(Math.min(s.i,QUESTIONS.length)/QUESTIONS.length*100)+'%';
 if(s.i>=QUESTIONS.length){meta.textContent='Finished';var d=el('div','card');d.append(el('div','muted','Your score'),el('div','big',s.score+' / '+QUESTIONS.length),el('p','muted','Best: '+s.best+' / '+QUESTIONS.length));
  var b=el('button','primary','Try again');b.onclick=function(){s.i=0;s.score=0;s.picked=null;save();render()};d.append(b);stage.append(d);return}
 var Q=QUESTIONS[s.i];meta.textContent='Question '+(s.i+1)+' of '+QUESTIONS.length;
 stage.append(el('p','q',Q.q));var o=el('div','opts');o.setAttribute('role','group');o.setAttribute('aria-label','Answers');
 Q.a.forEach(function(t,n){var b=el('button',null,t);if(s.picked!==null){b.disabled=true;if(n===Q.c)b.className='ok';else if(n===s.picked)b.className='no'}
  b.onclick=function(){if(s.picked!==null)return;s.picked=n;if(n===Q.c)s.score++;save();render()};o.append(b)});
 stage.append(o);var note=el('p','note');note.setAttribute('aria-live','polite');stage.append(note);
 if(s.picked!==null){note.textContent=s.picked===Q.c?'Correct.':'Not quite — the answer is “'+Q.a[Q.c]+'”.';
  var nx=el('button','primary',s.i+1<QUESTIONS.length?'Next question':'See score');nx.onclick=function(){s.i++;s.picked=null;if(s.i>=QUESTIONS.length&&s.score>s.best)s.best=s.score;save();render()};stage.append(nx)}}
render()`
)

const flashcards = doc(
  'Flashcards',
  `.deck{display:grid;gap:14px;justify-items:center}
.cardface{width:100%;min-height:150px;display:grid;place-items:center;text-align:center;padding:22px;border:1px solid var(--hermes-border);border-radius:14px;font-size:1.25rem;font-weight:600;cursor:pointer;user-select:none}
.cardface small{display:block;margin-bottom:6px;color:var(--hermes-muted);font-size:.75rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase}
.cardface.known{border-color:#16a34a}
.bar{height:6px;width:100%;border-radius:99px;background:var(--hermes-border);overflow:hidden}.bar i{display:block;height:100%;background:var(--hermes-accent)}`,
  `<h2>Flashcards</h2>
<p class="sub" id="meta"></p>
<div class="deck">
  <div class="bar" aria-hidden="true"><i id="fill"></i></div>
  <div class="cardface" id="face" role="button" tabindex="0" aria-live="polite"></div>
  <div class="row">
    <button id="prev">Previous</button>
    <button id="flip">Flip</button>
    <button id="know" class="primary">I know this</button>
    <button id="next">Next</button>
  </div>
  <button id="reset" class="muted">Start over</button>
</div>`,
  `var CARDS=[
 ['Photosynthesis','Plants turn light, water and CO₂ into sugar and oxygen.'],
 ['Opportunity cost','What you give up by choosing one option over the next best.'],
 ['Idempotent','Doing it twice has the same effect as doing it once.'],
 ['Pareto principle','Roughly 80% of effects come from 20% of causes.']
];
var s=Object.assign({i:0,known:[]},hermes.state||{}),shown=false;
var face=document.getElementById('face'),meta=document.getElementById('meta'),fill=document.getElementById('fill');
function save(){hermes.save(s)}
function render(){var c=CARDS[s.i],k=s.known.indexOf(s.i)>=0;
 face.textContent='';var small=document.createElement('small');small.textContent=shown?'Answer':'Term';face.append(small,document.createTextNode(shown?c[1]:c[0]));
 face.classList.toggle('known',k);face.setAttribute('aria-label',(shown?'Answer: ':'Term: ')+(shown?c[1]:c[0])+'. Press to flip.');
 meta.textContent='Card '+(s.i+1)+' of '+CARDS.length+' · '+s.known.length+' known';fill.style.width=(s.known.length/CARDS.length*100)+'%';
 document.getElementById('know').textContent=k?'Not yet':'I know this'}
function go(d){s.i=(s.i+d+CARDS.length)%CARDS.length;shown=false;save();render()}
function flip(){shown=!shown;render()}
face.onclick=flip;face.onkeydown=function(e){if(e.key===' '||e.key==='Enter'){e.preventDefault();flip()}};
document.getElementById('flip').onclick=flip;document.getElementById('prev').onclick=function(){go(-1)};document.getElementById('next').onclick=function(){go(1)};
document.getElementById('know').onclick=function(){var n=s.known.indexOf(s.i);if(n>=0)s.known.splice(n,1);else s.known.push(s.i);save();render()};
document.getElementById('reset').onclick=function(){s={i:0,known:[]};shown=false;save();render()};
render()`
)

const kpi = doc(
  'KPI dashboard',
  `.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.tile .k{display:flex;justify-content:space-between;color:var(--hermes-muted);font-size:.8125rem}
.tile input.v{margin:6px 0 2px;padding:2px 0;border:0;border-bottom:1px solid transparent;border-radius:0;font-size:1.75rem;font-weight:700;letter-spacing:-.02em;width:100%}
.tile input.v:hover,.tile input.v:focus{border-bottom-color:var(--hermes-border)}
.tile .t{display:flex;align-items:center;gap:6px;color:var(--hermes-muted);font-size:.8125rem}
.tile .t input{width:5.5em;padding:2px 6px;font-size:.8125rem}
.meter{height:6px;margin-top:10px;border-radius:99px;background:var(--hermes-border);overflow:hidden}.meter i{display:block;height:100%;background:var(--hermes-accent);transition:width .25s}
.meter i.hit{background:#16a34a}`,
  `<h2>KPI dashboard</h2>
<p class="sub">Click a number to change it. Bars show progress to target.</p>
<div class="tiles" id="tiles"></div>`,
  `var KPIS=[{id:'rev',name:'Revenue',unit:'$',value:48200,target:60000},{id:'cust',name:'Customers',unit:'',value:312,target:400},{id:'nps',name:'NPS',unit:'',value:46,target:50},{id:'ret',name:'Retention',unit:'%',value:91,target:95}];
var s=hermes.state||{};var f=new Intl.NumberFormat();
KPIS.forEach(function(k){if(s[k.id])Object.assign(k,s[k.id])});
var tiles=document.getElementById('tiles');
function save(){var o={};KPIS.forEach(function(k){o[k.id]={value:k.value,target:k.target}});hermes.save(o)}
function build(){KPIS.forEach(function(k){var t=document.createElement('div');t.className='card tile';
 var head=document.createElement('div');head.className='k';var n=document.createElement('span');n.textContent=k.name+(k.unit?' ('+k.unit+')':'');var pct=document.createElement('span');head.append(n,pct);
 var v=document.createElement('input');v.className='v';v.type='number';v.step='any';v.value=k.value;v.setAttribute('aria-label',k.name+' value');
 var tg=document.createElement('div');tg.className='t';var tl=document.createElement('span');tl.textContent='Target';var ti=document.createElement('input');ti.type='number';ti.step='any';ti.value=k.target;ti.setAttribute('aria-label',k.name+' target');tg.append(tl,ti);
 var m=document.createElement('div');m.className='meter';var bar=document.createElement('i');m.append(bar);
 function paint(){var p=k.target>0?Math.max(0,Math.min(k.value/k.target,1)):0;bar.style.width=(p*100)+'%';bar.className=p>=1?'hit':'';pct.textContent=Math.round(p*100)+'%'}
 v.oninput=function(){k.value=parseFloat(v.value)||0;paint();save()};ti.oninput=function(){k.target=parseFloat(ti.value)||0;paint();save()};
 t.append(head,v,tg,m);tiles.append(t);paint()})}
build()`
)

const chart = doc(
  'Chart',
  `.top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.seg{display:inline-flex;border:1px solid var(--hermes-border);border-radius:8px;overflow:hidden}.seg button{border:0;border-radius:0}.seg button[aria-pressed=true]{background:var(--hermes-accent);color:#fff}
svg{display:block;width:100%;height:auto;overflow:visible}svg text{fill:var(--hermes-muted);font-size:11px}
.axis{stroke:var(--hermes-border)}.mark{fill:var(--hermes-accent)}.line{fill:none;stroke:var(--hermes-accent);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
table{width:100%;margin-top:14px;border-collapse:collapse}td{padding:3px 4px 3px 0}td input{padding:5px 8px}td.x{width:2em;text-align:right}`,
  `<h2>Chart</h2>
<p class="sub">Edit the rows; the chart follows.</p>
<div class="top"><div class="seg" role="group" aria-label="Chart type"><button id="bar" aria-pressed="true">Bars</button><button id="ln" aria-pressed="false">Line</button></div><button id="add">Add row</button></div>
<svg id="svg" viewBox="0 0 560 240" role="img" aria-label="Chart of the values below"></svg>
<table><tbody id="rows"></tbody></table>`,
  `var s=Object.assign({kind:'bar',rows:[['Jan',12],['Feb',19],['Mar',15],['Apr',24],['May',28],['Jun',26]]},hermes.state||{});
var NS='http://www.w3.org/2000/svg',svg=document.getElementById('svg'),rows=document.getElementById('rows');
function save(){hermes.save(s)}
function se(n,a,t){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);if(t!=null)e.textContent=t;return e}
function draw(){svg.textContent='';var W=560,H=240,L=34,B=28,T=10,R=8,n=s.rows.length,max=Math.max.apply(null,s.rows.map(function(r){return r[1]}).concat([1]));
 var nice=Math.pow(10,Math.floor(Math.log10(max))),top=Math.ceil(max/nice)*nice;
 for(var g=0;g<=4;g++){var y=T+(H-T-B)*(1-g/4);svg.append(se('line',{x1:L,x2:W-R,y1:y,y2:y,class:'axis'}),se('text',{x:L-6,y:y+4,'text-anchor':'end'},Math.round(top*g/4*10)/10))}
 var step=(W-L-R)/Math.max(n,1),pts=[];
 s.rows.forEach(function(r,i){var x=L+step*i+step/2,h=(H-T-B)*r[1]/top,y=H-B-h;pts.push(x+','+y);
  if(s.kind==='bar')svg.append(se('rect',{x:x-step*.32,y:y,width:step*.64,height:Math.max(h,0),rx:4,class:'mark'}));else svg.append(se('circle',{cx:x,cy:y,r:4,class:'mark'}));
  svg.append(se('text',{x:x,y:H-8,'text-anchor':'middle'},r[0]))});
 if(s.kind==='line'&&n>1)svg.insertBefore(se('polyline',{points:pts.join(' '),class:'line'}),svg.querySelector('circle'))}
function table(){rows.textContent='';s.rows.forEach(function(r,i){var tr=document.createElement('tr');
 function cell(v,num){var td=document.createElement('td'),inp=document.createElement('input');inp.value=v;if(num){inp.type='number';inp.step='any'}inp.setAttribute('aria-label',(num?'Value':'Label')+' for row '+(i+1));
  inp.oninput=function(){r[num?1:0]=num?(parseFloat(inp.value)||0):inp.value;save();draw()};td.append(inp);return td}
 var x=document.createElement('td');x.className='x';var b=document.createElement('button');b.textContent='×';b.setAttribute('aria-label','Remove row '+(i+1));b.onclick=function(){s.rows.splice(i,1);save();table();draw()};x.append(b);
 tr.append(cell(r[0],false),cell(r[1],true),x);rows.append(tr)})}
function kind(k){s.kind=k;document.getElementById('bar').setAttribute('aria-pressed',k==='bar');document.getElementById('ln').setAttribute('aria-pressed',k==='line');save();draw()}
document.getElementById('bar').onclick=function(){kind('bar')};document.getElementById('ln').onclick=function(){kind('line')};
document.getElementById('add').onclick=function(){s.rows.push(['New',10]);save();table();draw()};
kind(s.kind);table()`
)

const timeline = doc(
  'Timeline',
  `.add{display:grid;grid-template-columns:150px 1fr auto;gap:8px;margin-bottom:18px}
@media(max-width:480px){.add{grid-template-columns:1fr}}
ol{list-style:none;margin:0;padding:0 0 0 18px;border-left:2px solid var(--hermes-border)}
li{position:relative;padding:0 0 16px 18px}
li::before{content:"";position:absolute;left:-26px;top:5px;width:12px;height:12px;border-radius:50%;background:var(--hermes-bg);border:2px solid var(--hermes-accent)}
li.done::before{background:var(--hermes-accent)}li.done .t{color:var(--hermes-muted);text-decoration:line-through}
.d{color:var(--hermes-muted);font-size:.8125rem}.t{font-weight:600}.acts{display:inline-flex;gap:6px;margin-left:8px}.acts button{padding:1px 8px;font-size:.75rem}
.empty{color:var(--hermes-muted)}`,
  `<h2>Timeline</h2>
<p class="sub">Dated milestones, in order. Tick one off when it is done.</p>
<form class="add" id="form"><input id="date" type="date" required aria-label="Date"><input id="title" type="text" placeholder="What happens?" required aria-label="Title"><button class="primary" type="submit">Add</button></form>
<ol id="list"></ol>`,
  `var today=new Date().toISOString().slice(0,10);
function day(n){var d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
var s=Object.assign({items:[{d:day(-14),t:'Kick-off',done:true},{d:day(7),t:'First draft ready',done:false},{d:day(30),t:'Launch',done:false}]},hermes.state||{});
var list=document.getElementById('list'),f=new Intl.DateTimeFormat(undefined,{dateStyle:'medium'});
function save(){hermes.save(s)}
function render(){list.textContent='';s.items.sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0});
 if(!s.items.length){var e=document.createElement('li');e.className='empty';e.textContent='Nothing yet — add the first milestone above.';list.append(e);return}
 s.items.forEach(function(it){var li=document.createElement('li');if(it.done)li.className='done';
  var d=document.createElement('div');d.className='d';d.textContent=f.format(new Date(it.d+'T00:00:00'));
  var t=document.createElement('span');t.className='t';t.textContent=it.t;
  var a=document.createElement('span');a.className='acts';var ck=document.createElement('button');ck.textContent=it.done?'Reopen':'Done';ck.onclick=function(){it.done=!it.done;save();render()};
  var rm=document.createElement('button');rm.textContent='Remove';rm.setAttribute('aria-label','Remove '+it.t);rm.onclick=function(){s.items.splice(s.items.indexOf(it),1);save();render()};
  a.append(ck,rm);li.append(d,t,a);list.append(li)})}
document.getElementById('date').value=today;
document.getElementById('form').onsubmit=function(e){e.preventDefault();var t=document.getElementById('title');s.items.push({d:document.getElementById('date').value,t:t.value.trim(),done:false});t.value='';save();render()};
render()`
)

export const INTERACTIVE_TEMPLATES: readonly InteractiveTemplate[] = [
  { html: roi, icon: 'graph-line', id: 'roi', title: 'ROI calculator' },
  { html: quiz, icon: 'checklist', id: 'quiz', title: 'Quiz' },
  { html: flashcards, icon: 'layers', id: 'flashcards', title: 'Flashcards' },
  { html: kpi, icon: 'dashboard', id: 'kpi', title: 'KPI dashboard' },
  { html: chart, icon: 'graph', id: 'chart', title: 'Chart' },
  { html: timeline, icon: 'history', id: 'timeline', title: 'Timeline' },
  ...WORK_TEMPLATES
]
