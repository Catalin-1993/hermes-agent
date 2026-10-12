/**
 * The working templates: a board, a timer, an invoice, a budget, a decision matrix and a currency
 * converter. Same rules as the first set (themed through `--hermes-*`, data kept with `hermes.save`,
 * nothing but the `hermes` object asked of the page) — and the converter is the one that asks for the
 * internet, for one named host, working from saved rates until the owner allows it.
 */

import { doc, type InteractiveTemplate } from './interactive-template-base'

/** Shared by these six: small caps labels, tabular figures, quiet surfaces, soft motion. */
const POLISH = `.eyebrow{font-size:.6875rem;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--hermes-muted)}
.num{font-variant-numeric:tabular-nums}
.surface{background:color-mix(in srgb,var(--hermes-fg) 4%,transparent);border-radius:14px}
.ghost{border-color:transparent;color:var(--hermes-muted)}.ghost:hover{color:var(--hermes-fg);border-color:var(--hermes-border)}
.icon{width:28px;height:28px;padding:0;display:inline-grid;place-items:center;line-height:1}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`

const kanban = doc(
  'Kanban board',
  `${POLISH}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px;align-items:start}
.col{padding:12px}.col h3{display:flex;justify-content:space-between;margin:2px 4px 10px}
.col.over{outline:2px dashed var(--hermes-accent);outline-offset:-4px}
.kc{margin-bottom:8px;padding:10px 11px;border:1px solid var(--hermes-border);border-radius:10px;background:var(--hermes-bg);cursor:grab;transition:border-color .15s,transform .15s}
.kc:hover{border-color:var(--hermes-accent)}.kc.drag{opacity:.45}.kc .t{word-break:break-word}
.kc .acts{display:flex;gap:4px;margin-top:8px}.kc .acts button{padding:1px 8px;font-size:.75rem}.kc .acts .x{margin-left:auto}
.add{display:flex;gap:6px;margin-top:4px}.add input{padding:7px 9px;font-size:.875rem}.add button{padding:5px 11px}
.empty{padding:10px 4px;color:var(--hermes-muted);font-size:.8125rem}`,
  `<h2>Board</h2>
<p class="sub">Drag a card to another column, or use the arrows.</p>
<div class="cols" id="cols"></div>`,
  `var COLS=[['todo','To do'],['doing','In progress'],['done','Done']];
var s=Object.assign({todo:['Define the scope','Draft the brief'],doing:['Design review'],done:['Kick-off meeting']},hermes.state||{});
var cols=document.getElementById('cols'),drag=null;
function save(){hermes.save(s)}
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function move(from,i,to,at){var c=s[from].splice(i,1)[0];if(c==null)return;var list=s[to];list.splice(at==null?list.length:Math.min(at,list.length),0,c);save();render()}
function render(){cols.textContent='';COLS.forEach(function(def,ci){var id=def[0],col=el('div','col surface');
 var h=el('h3','eyebrow');h.append(el('span',null,def[1]),el('span','num',String(s[id].length)));col.append(h);
 col.ondragover=function(e){e.preventDefault();col.classList.add('over')};col.ondragleave=function(){col.classList.remove('over')};
 col.ondrop=function(e){e.preventDefault();col.classList.remove('over');if(drag)move(drag.from,drag.i,id)};
 if(!s[id].length)col.append(el('div','empty','Nothing here yet.'));
 s[id].forEach(function(text,i){var c=el('div','kc');c.draggable=true;c.append(el('div','t',text));
  c.ondragstart=function(e){drag={from:id,i:i};c.classList.add('drag');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',text)}};
  c.ondragend=function(){drag=null;c.classList.remove('drag')};
  c.ondragover=function(e){e.preventDefault()};c.ondrop=function(e){e.preventDefault();e.stopPropagation();col.classList.remove('over');if(drag)move(drag.from,drag.i,id,i)};
  var a=el('div','acts');
  if(ci>0){var l=el('button','ghost','‹');l.setAttribute('aria-label','Move “'+text+'” to '+COLS[ci-1][1]);l.onclick=function(){move(id,i,COLS[ci-1][0])};a.append(l)}
  if(ci<COLS.length-1){var r=el('button','ghost','›');r.setAttribute('aria-label','Move “'+text+'” to '+COLS[ci+1][1]);r.onclick=function(){move(id,i,COLS[ci+1][0])};a.append(r)}
  var x=el('button','ghost x','Remove');x.setAttribute('aria-label','Remove “'+text+'”');x.onclick=function(){s[id].splice(i,1);save();render()};a.append(x);c.append(a);col.append(c)});
 var f=el('form','add'),inp=el('input');inp.placeholder='Add a card';inp.setAttribute('aria-label','New card in '+def[1]);var b=el('button','primary','Add');b.type='submit';
 f.onsubmit=function(e){e.preventDefault();var v=inp.value.trim();if(!v)return;s[id].push(v);save();render()};f.append(inp,b);col.append(f);cols.append(col)})}
render()`
)

const focus = doc(
  'Focus timer',
  `${POLISH}
body{display:grid;justify-items:center;text-align:center}
.wrap{width:min(100%,360px)}
.modes{display:inline-flex;margin:6px 0 18px;padding:3px;border-radius:99px;background:color-mix(in srgb,var(--hermes-fg) 6%,transparent)}
.modes button{border:0;border-radius:99px;padding:5px 14px;color:var(--hermes-muted)}.modes button[aria-pressed=true]{background:var(--hermes-bg);color:var(--hermes-fg);box-shadow:0 1px 3px rgba(0,0,0,.18)}
.ring{position:relative;width:230px;height:230px;margin:0 auto}
.ring svg{width:100%;height:100%;transform:rotate(-90deg)}.ring circle{fill:none;stroke-width:6}
.track{stroke:var(--hermes-border)}.prog{stroke:var(--hermes-accent);stroke-linecap:round;transition:stroke-dashoffset .25s linear}
.ring .t{position:absolute;inset:0;display:grid;place-content:center;gap:2px}
.time{font-size:3rem;font-weight:700;letter-spacing:-.03em}.lbl{color:var(--hermes-muted);font-size:.8125rem}
.done .prog{stroke:#16a34a}
.task{margin:20px 0 14px;text-align:center}
.btns{display:flex;gap:10px;justify-content:center}.btns button{padding:9px 22px;border-radius:99px}
.dots{display:flex;gap:6px;justify-content:center;margin-top:20px}.dots i{width:9px;height:9px;border-radius:50%;border:1.5px solid var(--hermes-accent)}.dots i.on{background:var(--hermes-accent)}`,
  `<div class="wrap">
<h2>Focus timer</h2>
<div class="modes" role="group" aria-label="Session type"><button data-m="focus">Focus</button><button data-m="short">Short break</button><button data-m="long">Long break</button></div>
<div class="ring" id="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="45"/><circle class="prog" id="prog" cx="50" cy="50" r="45"/></svg>
<div class="t"><div class="time num" id="time" role="timer" aria-live="off">25:00</div><div class="lbl" id="lbl"></div></div></div>
<input class="task" id="task" type="text" placeholder="What are you working on?" aria-label="Current task">
<div class="btns"><button class="primary" id="go">Start</button><button id="reset">Reset</button></div>
<div class="eyebrow" style="margin-top:20px" id="today"></div><div class="dots" id="dots" aria-hidden="true"></div>
</div>`,
  `var MIN={focus:25,short:5,long:15},LABEL={focus:'Stay on one thing',short:'Step away for a moment',long:'A longer rest'};
var today=new Date().toISOString().slice(0,10);
var s=Object.assign({mode:'focus',task:'',day:today,done:0},hermes.state||{});if(s.day!==today){s.day=today;s.done=0}
var C=2*Math.PI*45,prog=document.getElementById('prog'),timeEl=document.getElementById('time'),go=document.getElementById('go'),task=document.getElementById('task');
prog.style.strokeDasharray=C;var left=MIN[s.mode]*60,endsAt=0,tick=null;
function save(){hermes.save({mode:s.mode,task:s.task,day:s.day,done:s.done})}
function fmt(n){n=Math.max(0,Math.ceil(n));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function paint(){var total=MIN[s.mode]*60;timeEl.textContent=fmt(left);prog.style.strokeDashoffset=C*(1-left/total);
 document.getElementById('ring').classList.toggle('done',left<=0);document.getElementById('lbl').textContent=tick?LABEL[s.mode]:(left<=0?'Done — nice work':LABEL[s.mode]);
 document.querySelectorAll('.modes button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.m===s.mode)});
 go.textContent=tick?'Pause':(left<total&&left>0?'Resume':'Start');
 document.getElementById('today').textContent='Today · '+s.done+(s.done===1?' session':' sessions');
 var d=document.getElementById('dots');d.textContent='';for(var i=0;i<Math.max(4,s.done);i++){var e=document.createElement('i');if(i<s.done)e.className='on';d.append(e)}}
function stop(){if(tick){clearInterval(tick);tick=null}}
function finish(){stop();left=0;if(s.mode==='focus'){s.done++;save()}paint()}
function step(){left=(endsAt-Date.now())/1000;if(left<=0)finish();else paint()}
function setMode(m){stop();s.mode=m;left=MIN[m]*60;save();paint()}
go.onclick=function(){if(tick){stop();paint();return}if(left<=0)left=MIN[s.mode]*60;endsAt=Date.now()+left*1000;tick=setInterval(step,250);paint()};
document.getElementById('reset').onclick=function(){stop();left=MIN[s.mode]*60;paint()};
document.querySelectorAll('.modes button').forEach(function(b){b.onclick=function(){setMode(b.dataset.m)}});
task.value=s.task;task.oninput=function(){s.task=task.value;save()};
paint()`
)

const invoice = doc(
  'Invoice',
  `${POLISH}
body{max-width:760px}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}
.head h2{font-size:1.5rem;letter-spacing:-.02em}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0 14px}
.party input{border-color:transparent;padding-left:0;background:transparent}.party input:hover,.party input:focus{border-color:var(--hermes-border);padding-left:10px}
table{width:100%;border-collapse:collapse;margin:16px 0 8px}
th{padding:6px 6px 8px;text-align:left}th.r,td.r{text-align:right}
td{padding:4px 4px;border-top:1px solid var(--hermes-border);vertical-align:middle}
td input{border-color:transparent;padding:6px 6px}td input:hover,td input:focus{border-color:var(--hermes-border)}
td input.n{text-align:right}td.amt{white-space:nowrap;padding-right:8px}
.totals{margin-left:auto;width:min(100%,300px)}.totals div{display:flex;justify-content:space-between;padding:6px 0}
.totals .pct{display:flex;gap:6px;align-items:center}.totals .pct input{width:64px;padding:3px 7px;text-align:right}
.totals .sum{margin-top:6px;padding-top:12px;border-top:2px solid var(--hermes-fg);font-size:1.375rem;font-weight:700}.sum span:last-child{color:var(--hermes-accent)}
select{width:auto;padding:4px 8px}`,
  `<div class="head"><div><h2>Invoice</h2><div class="muted"><input id="no" type="text" aria-label="Invoice number" style="border:0;padding:0;width:11em;background:transparent"></div></div>
<div><label for="date" style="margin:0">Date</label><input id="date" type="date" style="width:auto"></div></div>
<div class="meta"><div class="party"><div class="eyebrow">From</div><input id="from" type="text" placeholder="Your name or company" aria-label="From"></div>
<div class="party"><div class="eyebrow">Bill to</div><input id="to" type="text" placeholder="Client" aria-label="Bill to"></div>
<div><div class="eyebrow">Currency</div><select id="cur" aria-label="Currency"><option>USD</option><option>EUR</option><option>GBP</option><option>RON</option><option>CHF</option></select></div></div>
<table><thead><tr class="eyebrow"><th>Description</th><th class="r" style="width:70px">Qty</th><th class="r" style="width:100px">Price</th><th class="r" style="width:110px">Amount</th><th style="width:34px"></th></tr></thead><tbody id="rows"></tbody></table>
<button id="add" class="ghost">+ Add line</button>
<div class="totals num"><div><span class="muted">Subtotal</span><span id="sub"></span></div>
<div><span class="pct muted">Discount <input id="disc" type="number" min="0" max="100" step="any" aria-label="Discount percent">%</span><span id="dv"></span></div>
<div><span class="pct muted">Tax <input id="tax" type="number" min="0" max="100" step="any" aria-label="Tax percent">%</span><span id="tv"></span></div>
<div class="sum"><span>Total</span><span id="total"></span></div></div>`,
  `var today=new Date().toISOString().slice(0,10);
var s=Object.assign({no:'INV-0001',date:today,from:'',to:'',cur:'USD',tax:19,disc:0,rows:[{d:'Design and development',q:1,p:2400},{d:'Hosting (12 months)',q:12,p:25}]},hermes.state||{});
var rows=document.getElementById('rows');
function $(id){return document.getElementById(id)}
function save(){hermes.save(s)}
function money(n){try{return new Intl.NumberFormat(undefined,{style:'currency',currency:s.cur}).format(n)}catch(e){return n.toFixed(2)}}
function calc(){var sub=s.rows.reduce(function(a,r){return a+(+r.q||0)*(+r.p||0)},0),dv=sub*(+s.disc||0)/100,tv=(sub-dv)*(+s.tax||0)/100;
 $('sub').textContent=money(sub);$('dv').textContent='−'+money(dv);$('tv').textContent=money(tv);$('total').textContent=money(sub-dv+tv);
 s.rows.forEach(function(r,i){var c=document.getElementById('amt'+i);if(c)c.textContent=money((+r.q||0)*(+r.p||0))})}
function build(){rows.textContent='';s.rows.forEach(function(r,i){var tr=document.createElement('tr');
 function cell(key,cls,type,label){var td=document.createElement('td'),inp=document.createElement('input');inp.type=type;if(type==='number'){inp.step='any';inp.min='0';inp.className='n'}inp.value=r[key];inp.setAttribute('aria-label',label+' for line '+(i+1));
  inp.oninput=function(){r[key]=type==='number'?(parseFloat(inp.value)||0):inp.value;save();calc()};if(cls)td.className=cls;td.append(inp);return td}
 var amt=document.createElement('td');amt.className='r amt';amt.id='amt'+i;
 var x=document.createElement('td'),b=document.createElement('button');b.className='ghost icon';b.textContent='×';b.setAttribute('aria-label','Remove line '+(i+1));b.onclick=function(){s.rows.splice(i,1);save();build();calc()};x.append(b);
 tr.append(cell('d',null,'text','Description'),cell('q','r','number','Quantity'),cell('p','r','number','Price'),amt,x);rows.append(tr)});calc()}
[['no','no'],['date','date'],['from','from'],['to','to'],['cur','cur']].forEach(function(p){var e=$(p[1]);e.value=s[p[0]];e.oninput=e.onchange=function(){s[p[0]]=e.value;save();calc()}});
[['tax','tax'],['disc','disc']].forEach(function(p){var e=$(p[1]);e.value=s[p[0]];e.oninput=function(){s[p[0]]=parseFloat(e.value)||0;save();calc()}});
$('add').onclick=function(){s.rows.push({d:'New item',q:1,p:0});save();build()};
build()`
)

const budget = doc(
  'Monthly budget',
  `${POLISH}
.top{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px}
.top .card .v{font-size:1.375rem;font-weight:650;margin-top:2px}.top input{margin-top:4px;font-size:1.125rem;font-weight:600}
.body{display:grid;grid-template-columns:minmax(0,230px) minmax(0,1fr);gap:22px;align-items:center}
@media(max-width:520px){.body{grid-template-columns:1fr}}
.donut{position:relative;width:100%;max-width:230px;margin:0 auto}.donut svg{display:block;width:100%;transform:rotate(-90deg)}
.donut circle{fill:none;stroke-width:14}.donut .track{stroke:var(--hermes-border)}.donut .seg{transition:stroke-dasharray .3s,stroke-dashoffset .3s}
.donut .c{position:absolute;inset:0;display:grid;place-content:center;text-align:center}.donut .c b{font-size:1.625rem;letter-spacing:-.02em}
.list{display:grid;gap:4px}.item{display:grid;grid-template-columns:12px minmax(0,1fr) 92px 44px 26px;gap:8px;align-items:center}
.item i{width:10px;height:10px;border-radius:50%}.item input{padding:5px 8px;border-color:transparent}.item input:hover,.item input:focus{border-color:var(--hermes-border)}
.item input.n{text-align:right}.item .p{text-align:right;color:var(--hermes-muted);font-size:.8125rem}
.over{color:#dc2626}`,
  `<h2>Monthly budget</h2>
<p class="sub">Where the month goes. Edit any figure.</p>
<div class="top"><div class="card"><div class="eyebrow">Income</div><input id="inc" type="number" min="0" step="any" aria-label="Monthly income"></div>
<div class="card"><div class="eyebrow">Spent</div><div class="v num" id="spent"></div></div>
<div class="card"><div class="eyebrow" id="leftLbl">Left</div><div class="v num" id="left"></div></div></div>
<div class="body"><div class="donut"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="40"/><g id="segs"></g></svg><div class="c"><b class="num" id="pct"></b><span class="muted">of income spent</span></div></div>
<div><div class="list" id="list"></div><button id="add" class="ghost" style="margin-top:6px">+ Add category</button></div></div>`,
  `var s=Object.assign({inc:3200,items:[['Housing',1200],['Food',450],['Transport',180],['Leisure',220],['Savings',400]]},hermes.state||{});
var C=2*Math.PI*40;
function $(id){return document.getElementById(id)}
function save(){hermes.save(s)}
function money(n){return new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(n)}
function hue(i){return 'hsl('+((i*53+215)%360)+' 62% 56%)'}
function draw(){var total=s.items.reduce(function(a,r){return a+(+r[1]||0)},0),base=Math.max(total,+s.inc||0,1),acc=0,g=$('segs');g.textContent='';
 s.items.forEach(function(r,i){var len=(+r[1]||0)/base*C;if(len<=0)return;var c=document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('class','seg');c.setAttribute('cx',50);c.setAttribute('cy',50);c.setAttribute('r',40);c.style.stroke=hue(i);c.style.strokeDasharray=Math.max(len-1.2,0)+' '+(C-Math.max(len-1.2,0));c.style.strokeDashoffset=-acc;g.append(c);acc+=len});
 var left=(+s.inc||0)-total;$('spent').textContent=money(total);$('left').textContent=money(left);$('left').className='v num'+(left<0?' over':'');$('leftLbl').textContent=left<0?'Over budget':'Left';
 $('pct').textContent=(s.inc>0?Math.round(total/s.inc*100):0)+'%';
 s.items.forEach(function(r,i){var p=document.getElementById('p'+i);if(p)p.textContent=(s.inc>0?Math.round((+r[1]||0)/s.inc*100):0)+'%'})}
function build(){var l=$('list');l.textContent='';s.items.forEach(function(r,i){var row=document.createElement('div');row.className='item';
 var dot=document.createElement('i');dot.style.background=hue(i);
 var name=document.createElement('input');name.value=r[0];name.setAttribute('aria-label','Category '+(i+1));name.oninput=function(){r[0]=name.value;save()};
 var amt=document.createElement('input');amt.type='number';amt.min='0';amt.step='any';amt.className='n num';amt.value=r[1];amt.setAttribute('aria-label',r[0]+' amount');amt.oninput=function(){r[1]=parseFloat(amt.value)||0;save();draw()};
 var p=document.createElement('span');p.className='p num';p.id='p'+i;
 var x=document.createElement('button');x.className='ghost icon';x.textContent='×';x.setAttribute('aria-label','Remove '+r[0]);x.onclick=function(){s.items.splice(i,1);save();build();draw()};
 row.append(dot,name,amt,p,x);l.append(row)});draw()}
$('inc').value=s.inc;$('inc').oninput=function(){s.inc=parseFloat($('inc').value)||0;save();draw()};
$('add').onclick=function(){s.items.push(['New category',0]);save();build()};
build()`
)

const decision = doc(
  'Decision matrix',
  `${POLISH}
.wrap{overflow-x:auto;margin:0 -4px;padding:0 4px}
table{width:100%;border-collapse:separate;border-spacing:0 4px;min-width:520px}
th,td{padding:4px 5px;text-align:center}th:first-child,td:first-child{text-align:left}
td input,th input{padding:6px 8px;border-color:transparent;text-align:center}th input{display:inline-block;width:calc(100% - 34px)}td input:hover,td input:focus,th input:hover,th input:focus{border-color:var(--hermes-border)}
td:first-child input{text-align:left}th input{font-weight:650}
.w{width:62px}.sc{width:70px}
tr.total td{padding-top:12px;border-top:2px solid var(--hermes-fg)}
.score{font-size:1.25rem;font-weight:700}.bar{height:6px;margin-top:6px;border-radius:99px;background:var(--hermes-border);overflow:hidden}.bar i{display:block;height:100%;background:color-mix(in srgb,var(--hermes-fg) 28%,transparent);transition:width .25s}
.win .score{color:var(--hermes-accent)}.win .bar i{background:var(--hermes-accent)}
.verdict{margin:16px 0 0;padding:12px 14px;border-radius:12px;background:color-mix(in srgb,var(--hermes-accent) 12%,transparent)}`,
  `<h2>Decision matrix</h2>
<p class="sub">Weigh each criterion (1–5), score each option (1–10). The best total wins.</p>
<div class="wrap"><table><thead id="head"></thead><tbody id="body"></tbody><tfoot id="foot"></tfoot></table></div>
<div class="row" style="margin-top:8px"><button id="addC" class="ghost">+ Criterion</button><button id="addO" class="ghost">+ Option</button></div>
<div class="verdict" id="verdict" role="status" aria-live="polite"></div>`,
  `var s=Object.assign({opts:['Option A','Option B','Option C'],crit:[['Cost',5,[6,8,4]],['Quality',4,[9,6,7]],['Speed',3,[5,7,9]],['Risk',4,[7,5,6]]]},hermes.state||{});
function $(id){return document.getElementById(id)}
function save(){hermes.save(s)}
function clamp(v,a,b){v=parseFloat(v);return isNaN(v)?a:Math.min(b,Math.max(a,v))}
function field(val,label,onin,cls,type){var i=document.createElement('input');if(type){i.type=type;i.step='any'}if(cls)i.className=cls;i.value=val;i.setAttribute('aria-label',label);i.oninput=function(){onin(i.value)};return i}
function totals(){return s.opts.map(function(_,o){return s.crit.reduce(function(a,c){return a+c[1]*(c[2][o]||0)},0)})}
function paint(){var t=totals(),max=Math.max.apply(null,t.concat([1])),best=t.indexOf(Math.max.apply(null,t));
 s.opts.forEach(function(_,o){var c=document.getElementById('t'+o);c.textContent=t[o];document.getElementById('b'+o).style.width=(t[o]/max*100)+'%';c.closest('td').classList.toggle('win',o===best&&max>1)});
 $('verdict').textContent=max>1?(s.opts[best]||'—')+' leads with '+t[best]+' points'+(t.filter(function(x){return x===t[best]}).length>1?' (tied)':'')+'.':'Add scores to see a result.'}
function build(){var h=$('head'),b=$('body'),f=$('foot');h.textContent='';b.textContent='';f.textContent='';
 var hr=document.createElement('tr'),c0=document.createElement('th');c0.className='eyebrow';c0.textContent='Criterion';var cw=document.createElement('th');cw.className='eyebrow';cw.textContent='Weight';hr.append(c0,cw);
 s.opts.forEach(function(name,o){var th=document.createElement('th');th.append(field(name,'Option '+(o+1)+' name',function(v){s.opts[o]=v;save();paint()}));
  if(s.opts.length>2){var x=document.createElement('button');x.className='ghost icon';x.textContent='×';x.setAttribute('aria-label','Remove option '+name);x.onclick=function(){s.opts.splice(o,1);s.crit.forEach(function(c){c[2].splice(o,1)});save();build()};th.append(x)}hr.append(th)});h.append(hr);
 s.crit.forEach(function(c,i){var tr=document.createElement('tr'),n=document.createElement('td');n.append(field(c[0],'Criterion '+(i+1),function(v){c[0]=v;save()}));
  var w=document.createElement('td');w.append(field(c[1],c[0]+' weight',function(v){c[1]=clamp(v,1,5);save();paint()},'w num','number'));tr.append(n,w);
  s.opts.forEach(function(_,o){var td=document.createElement('td');td.append(field(c[2][o]||0,c[0]+', option '+(o+1)+' score',function(v){c[2][o]=clamp(v,0,10);save();paint()},'sc num','number'));tr.append(td)});
  var xd=document.createElement('td'),x=document.createElement('button');x.className='ghost icon';x.textContent='×';x.setAttribute('aria-label','Remove '+c[0]);x.onclick=function(){s.crit.splice(i,1);save();build()};xd.append(x);tr.append(xd);b.append(tr)});
 var fr=document.createElement('tr');fr.className='total';var l=document.createElement('td');l.colSpan=2;l.textContent='Total';l.className='eyebrow';fr.append(l);
 s.opts.forEach(function(_,o){var td=document.createElement('td'),sc=document.createElement('div');sc.className='score num';sc.id='t'+o;var bar=document.createElement('div');bar.className='bar';var i=document.createElement('i');i.id='b'+o;bar.append(i);td.append(sc,bar);fr.append(td)});f.append(fr);paint()}
$('addC').onclick=function(){s.crit.push(['New criterion',3,s.opts.map(function(){return 5})]);save();build()};
$('addO').onclick=function(){if(s.opts.length>=5)return;s.opts.push('Option '+String.fromCharCode(65+s.opts.length));s.crit.forEach(function(c){c[2].push(5)});save();build()};
build()`
)

const currency = doc(
  'Currency converter',
  `${POLISH}
body{max-width:520px}
.pair{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:end;margin-top:6px}
.pair button{height:38px;width:38px;padding:0;border-radius:50%}
.amount{font-size:1.25rem;font-weight:600;padding:10px 12px}
.out{margin:20px 0 6px;padding:18px 20px;text-align:left}.out .big{font-size:2.5rem}.out .rate{margin-top:6px;color:var(--hermes-muted);font-size:.875rem}
.live{display:inline-flex;align-items:center;gap:6px;margin-top:10px;font-size:.8125rem;color:var(--hermes-muted)}.live i{width:8px;height:8px;border-radius:50%;background:var(--hermes-muted)}.live.on i{background:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.2)}
.also{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:14px}.also div{padding:9px 11px;border:1px solid var(--hermes-border);border-radius:10px}.also b{display:block;font-size:1rem}`,
  `<h2>Currency converter</h2>
<p class="sub">Live rates when this block may reach the internet; saved rates otherwise.</p>
<label for="amt" style="margin-top:0">Amount</label><input id="amt" class="amount num" type="number" min="0" step="any">
<div class="pair"><div><label for="from">From</label><select id="from"></select></div><button id="swap" aria-label="Swap currencies" title="Swap">⇄</button><div><label for="to">To</label><select id="to"></select></div></div>
<div class="card out surface"><div class="big num" id="res" aria-live="polite">–</div><div class="rate num" id="rate"></div><div class="live" id="live"><i></i><span id="src"></span></div></div>
<div class="eyebrow">Also in</div><div class="also" id="also"></div>`,
  `var SAMPLE={EUR:1,USD:1.08,GBP:0.85,CHF:0.95,RON:4.97,PLN:4.3,JPY:162,CAD:1.47,AUD:1.65,SEK:11.4,CZK:25.2,HUF:395};
var s=Object.assign({amt:100,from:'EUR',to:'USD',rates:SAMPLE,date:'',live:false},hermes.state||{});
function $(id){return document.getElementById(id)}
function save(){hermes.save({amt:s.amt,from:s.from,to:s.to,rates:s.rates,date:s.date,live:s.live})}
function codes(){return Object.keys(s.rates).sort()}
function fill(sel){sel.textContent='';codes().forEach(function(c){var o=document.createElement('option');o.value=o.textContent=c;sel.append(o)});}
function cross(a,b){return s.rates[b]/s.rates[a]}
function fmt(n,c){try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:n<1000?2:0}).format(n)}catch(e){return n.toFixed(2)+' '+c}}
function paint(){var r=cross(s.from,s.to),v=(+s.amt||0)*r;$('res').textContent=isFinite(v)?fmt(v,s.to):'–';
 $('rate').textContent=isFinite(r)?'1 '+s.from+' = '+r.toFixed(r<10?4:2)+' '+s.to:'';
 $('live').classList.toggle('on',s.live);$('src').textContent=s.live?'Live rates · '+s.date:(s.date?'Saved rates · '+s.date:'Sample rates — allow internet access on this block for live ones');
 var a=$('also');a.textContent='';['EUR','USD','GBP','RON'].filter(function(c){return c!==s.to&&s.rates[c]}).slice(0,4).forEach(function(c){var d=document.createElement('div'),b=document.createElement('b');b.textContent=fmt((+s.amt||0)*cross(s.from,c),c);d.append(b,document.createTextNode(c));a.append(d)})}
function load(){if(typeof fetch!=='function')return;var ctl=typeof AbortController==='function'?new AbortController():null,t=setTimeout(function(){if(ctl)ctl.abort()},6000);
 fetch('https://api.frankfurter.dev/v1/latest?base=EUR',ctl?{signal:ctl.signal}:{}).then(function(r){return r.ok?r.json():Promise.reject()}).then(function(d){clearTimeout(t);
  if(!d||!d.rates)return;s.rates=Object.assign({EUR:1},d.rates);s.date=d.date||'';s.live=true;fill($('from'));fill($('to'));$('from').value=s.from;$('to').value=s.to;save();paint()}).catch(function(){clearTimeout(t);s.live=false;paint()})}
fill($('from'));fill($('to'));$('from').value=s.from;$('to').value=s.to;$('amt').value=s.amt;
$('amt').oninput=function(){s.amt=parseFloat($('amt').value)||0;save();paint()};
$('from').onchange=function(){s.from=$('from').value;save();paint()};$('to').onchange=function(){s.to=$('to').value;save();paint()};
$('swap').onclick=function(){var f=s.from;s.from=s.to;s.to=f;$('from').value=s.from;$('to').value=s.to;save();paint()};
s.live=false;paint();load()`,
  '<meta name="hermes:network" content="api.frankfurter.dev">\n'
)

export const WORK_TEMPLATES: readonly InteractiveTemplate[] = [
  { html: kanban, icon: 'project', id: 'kanban', title: 'Kanban board' },
  { html: focus, icon: 'clock', id: 'focus', title: 'Focus timer' },
  { html: invoice, icon: 'credit-card', id: 'invoice', title: 'Invoice' },
  { html: budget, icon: 'pie-chart', id: 'budget', title: 'Monthly budget' },
  { html: decision, icon: 'law', id: 'decision', title: 'Decision matrix' },
  { html: currency, icon: 'globe', id: 'currency', title: 'Currency converter' }
]
