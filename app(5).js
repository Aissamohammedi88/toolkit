// NERCEL v10.0 — dashboard
const API='';
let me=null, projects=[], currentProject=null, allServices=[], sysTimer=null;

const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const esc=s=>(s==null?'':String(s)).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
function toast(m,k='ok'){const t=$('#toast');t.textContent=m;t.className='toast '+(k||'ok');t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>t.hidden=true,3600);}
async function api(method,path,body,isForm){
  const opt={method,credentials:'include'};
  if(body){if(isForm)opt.body=body;else{opt.body=JSON.stringify(body);opt.headers={'Content-Type':'application/json'};}}
  try{const r=await fetch(API+path,opt);const t=await r.text();const d=t?JSON.parse(t):{};
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d;}catch(e){if(e.message==='Failed to fetch')throw new Error('serveur injoignable');throw e;}
}
// minimal markdown → HTML (escape first, then format)
function mdToHtml(s){
  s=esc(s);
  s=s.replace(/```([\s\S]*?)```/g,(m,c)=>`<pre><code>${c.replace(/^\n/,'')}</code></pre>`);
  s=s.replace(/`([^`\n]+)`/g,'<code>$1</code>');
  s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/^[-*] (.+)$/gm,'• $1');
  s=s.replace(/\n/g,'<br>');
  return s;
}

// ===================== AUTH =====================
function setAuthTabs(){
  $$('.auth-tab').forEach(t=>t.addEventListener('click',()=>{
    $$('.auth-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
    const mode=t.dataset.auth;$('#auth-mode').value=mode;
    $('#auth-submit').textContent=mode==='login'?'Se connecter':'Créer le compte';
    $('#email-field').hidden=mode==='login';$('#email').required=mode==='register';$('#auth-error').hidden=true;
  }));
}
$('#auth-form').addEventListener('submit',async e=>{
  e.preventDefault();const mode=$('#auth-mode').value;
  const payload={username:$('#username').value.trim(),password:$('#password').value};
  if(mode==='register')payload.email=$('#email').value.trim();
  $('#auth-submit').disabled=true;
  try{const d=await api('POST','/api/auth/'+mode,payload);me=d.user;enterApp();toast('Bienvenue '+me.username);}
  catch(err){const el=$('#auth-error');el.textContent=err.message;el.hidden=false;}
  finally{$('#auth-submit').disabled=false;}
});
function enterApp(){
  $('#auth-screen').style.display='none';$('#app').hidden=false;
  $('#avatar').textContent=(me.username||'?').slice(0,2).toUpperCase();
  $('#proj-cur').textContent=me.username+'-ws';
  nav('overview');
  loadStatus();loadAnalytics();loadOverview();connectLogs();loadAgents();loadProjects();
  loadServices();startPolling();
}

// ===================== NAVIGATION =====================
function nav(page){
  $$('.sb-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  $$('.page').forEach(p=>p.classList.remove('active'));
  const el=$('#page-'+page);if(el)el.classList.add('active');
  if(page==='overview')loadOverview();
  if(page==='analytics')loadAnalytics();
  if(page==='system')loadSystem();
  if(page==='deployments')loadDeployments();
  if(page==='edge')loadEdge();
  if(page==='agents')loadAgents();
  if(page==='aihub')loadAIHub();
  if(page==='scaffolds')loadScaffolds();
  if(page==='devops')loadDevOpsPage();
  if(page==='github')loadGithub();
  if(page==='settings')loadSettings();
}
$$('.sb-item').forEach(x=>x.addEventListener('click',()=>nav(x.dataset.page)));
$('#sidebar-toggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));

// ===================== CANVAS CHARTS =====================
function drawLineChart(canvas,data,color){
  if(!canvas)return;const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const W=canvas.clientWidth,H=canvas.clientHeight;
  if(W<2||H<2)return;
  canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  if(!data||data.length<2)return;
  const pad=10,max=Math.max(...data)*1.1||1,min=Math.min(...data)*0.9||0;
  const range=max-min||1;
  ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;
  for(let i=0;i<4;i++){const y=pad+(H-2*pad)*i/3;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();}
  const x=i=>pad+(W-2*pad)*i/(data.length-1);
  const y=v=>pad+(H-2*pad)*(1-(v-min)/range);
  const grad=ctx.createLinearGradient(0,pad,0,H);
  grad.addColorStop(0,color+'40');grad.addColorStop(1,color+'02');
  ctx.beginPath();ctx.moveTo(x(0),H-pad);
  data.forEach((v,i)=>ctx.lineTo(x(i),y(v)));
  ctx.lineTo(x(data.length-1),H-pad);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.moveTo(x(0),y(data[0]));
  data.forEach((v,i)=>ctx.lineTo(x(i),y(v)));
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
  ctx.beginPath();ctx.arc(x(data.length-1),y(data[data.length-1]),3.5,0,7);ctx.fillStyle=color;ctx.fill();
  ctx.beginPath();ctx.arc(x(data.length-1),y(data[data.length-1]),6,0,7);ctx.fillStyle=color+'33';ctx.fill();
}
function drawGauge(canvas,pct,color){
  if(!canvas)return;const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const S=canvas.clientWidth;const size=S||92;
  canvas.width=size*dpr;canvas.height=size*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,size,size);
  const cx=size/2,cy=size/2,r=size/2-9,start=Math.PI*0.75,end=Math.PI*2.25;
  ctx.lineWidth=7;ctx.lineCap='round';
  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.beginPath();ctx.arc(cx,cy,r,start,end);ctx.stroke();
  const val=Math.max(0,Math.min(1,pct/100));
  ctx.strokeStyle=color;ctx.beginPath();ctx.arc(cx,cy,r,start,start+(end-start)*val);ctx.stroke();
  ctx.shadowBlur=12;ctx.shadowColor=color;ctx.beginPath();ctx.arc(cx,cy,r,start,start+(end-start)*val);ctx.stroke();ctx.shadowBlur=0;
}
function drawSpark(canvas,data,color){
  if(!canvas)return;const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;const W=canvas.clientWidth,H=canvas.clientHeight;
  if(W<2||H<2)return;
  canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  if(!data||data.length<2)return;
  const max=Math.max(...data),min=Math.min(...data),range=max-min||1;
  const x=i=>i*W/(data.length-1),y=v=>H-4-(v-min)/range*(H-8);
  const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,color+'40');grad.addColorStop(1,color+'02');
  ctx.beginPath();ctx.moveTo(0,H);data.forEach((v,i)=>ctx.lineTo(x(i),y(v)));ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.moveTo(0,y(data[0]));data.forEach((v,i)=>ctx.lineTo(x(i),y(v)));ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.stroke();
}

// ===================== ANALYTICS =====================
let analyticsTimer=null, currentPeriod='24h';
async function loadAnalytics(){
  try{
    const d=await api('GET','/api/analytics?period='+currentPeriod);
    const k=d.kpis;
    $('#kpi-row').innerHTML=[
      {l:'Requêtes 24h',v:k.requests_24h,d:k.requests_delta+'%',dc:k.requests_delta>0?'up':'down',dir:'▲'},
      {l:'Taux erreur 5XX',v:k.error_rate,d:k.error_delta+' pts',dc:'down',dir:'▼'},
      {l:'Uptime 30j',v:k.uptime,d:'SLA OK',dc:'up',dir:''},
      {l:'Bande passante',v:k.bandwidth,d:k.bw_delta+'%',dc:'warn',dir:'▲'},
    ].map(kp=>`<div class="kpi"><div class="kpi-label">${kp.l}</div><div class="kpi-val">${kp.v}</div><div class="kpi-delta ${kp.dc}">${kp.dir} ${kp.d}</div></div>`).join('');
    drawLineChart($('#chart-requests'),d.series.requests,'#38bdf8');
    drawLineChart($('#chart-cpu'),d.series.cpu,'#22e07a');
    drawLineChart($('#chart-ram'),d.series.ram,'#f5b945');
    drawLineChart($('#chart-latency'),d.series.latency,'#a78bfa');
    $('#rpm-badge').textContent=k.rpm+' /min';
    $('#cpu-badge').textContent=d.cpu+'%';
    $('#ram-badge').textContent=d.ram+'%';
    $('#latency-badge').textContent=k.p95_latency||'—';
    $('#web-vitals').innerHTML=d.web_vitals.map(w=>`<div class="wv"><div class="wv-k">${w.k}</div><div class="wv-v">${w.v}</div><div class="wv-status">${w.status}</div></div>`).join('');
    $('#traffic-list').innerHTML=d.traffic.map(t=>`<div class="traffic-row"><span class="traffic-flag">${t.flag}</span><span class="traffic-country">${t.country}</span><div class="traffic-bar"><div class="traffic-bar-fill" style="width:${t.pct}%"></div></div><span class="traffic-pct">${t.pct}%</span></div>`).join('');
    $('#b-overview').textContent=d.projects;$('#b-deploys').textContent=d.deploys;$('#b-agents').textContent=d.agents;
    $('#sb-services').innerHTML=`<span class="live-dot"></span><span class="green">${d.features} / ${d.features} services active</span>`;
  }catch(e){console.warn('analytics',e);}
}
$('#period-sel')&&Array.from($('#period-sel').children).forEach(b=>b.addEventListener('click',()=>{
  currentPeriod=b.dataset.p;Array.from($('#period-sel').children).forEach(x=>x.classList.remove('active'));b.classList.add('active');loadAnalytics();
}));

// ===================== OVERVIEW =====================
async function loadOverview(){
  try{
    const [st,an]=await Promise.all([api('GET','/api/status'),api('GET','/api/analytics')]);
    $('#overview-stats').innerHTML=[
      {l:'Projets',v:st.projects.length},{l:'En ligne',v:st.running},
      {l:'Agents',v:an.agents},{l:'CPU / RAM',v:st.cpu+'% / '+st.ram+'%'}
    ].map(s=>`<div class="stat"><div class="stat-label">${s.l}</div><div class="stat-val">${s.v}</div></div>`).join('');
    $('#hm-proj').textContent=st.projects.length;$('#hm-run').textContent=st.running;
    $('#hm-agents').textContent=an.agents;$('#hm-feat').textContent=st.features;
    $('#hm-up').textContent=Math.floor(st.uptime/60)+'m';
    $('#ov-projects').innerHTML=st.projects.length?st.projects.slice(0,5).map(p=>`<div class="kv"><span class="k">📦 ${esc(p.name)}</span><span class="v">${esc(p.framework||'?')} · :${p.port}</span></div>`).join(''):'<div class="dim pad">Aucun projet — déploie un zip ou connecte GitHub</div>';
    const deps=await api('GET','/api/deployments');
    $('#ov-deploys').innerHTML=deps.deployments.length?deps.deployments.slice(0,5).map(d=>`<div class="kv"><span class="k mono-sm">${esc(d.commit_hash)}</span><span class="v">${esc(d.project)} · ${esc(d.env)}</span></div>`).join(''):'<div class="dim pad">Aucun déploiement</div>';
  }catch(e){console.warn('overview',e);}
}
async function loadServices(){
  if(allServices.length)return;
  try{const d=await api('GET','/api/features');allServices=d.features;
    $('#ov-svc-count').textContent=d.total+' services';
    $('#ov-services').innerHTML=allServices.map(f=>`<div class="svc-pill"><span class="svc-dot ${f.status}"></span>${esc(f.name)}<span class="svc-sprint">S${f.sprint}</span></div>`).join('');
  }catch(e){}
}

// ===================== STATUS / PROJECTS =====================
async function loadStatus(){
  try{const d=await api('GET','/api/status');
    projects=d.projects;
    $('#b-overview').textContent=d.projects.length;
    const colors=['#38bdf8','#a78bfa','#22e07a','#f5b945','#fb5d5d','#fb923c'];
    $('#sb-projects').innerHTML=d.projects.length?d.projects.map((p,i)=>`<div class="sb-proj-item" data-name="${esc(p.name)}"><span class="sb-proj-dot" style="background:${colors[i%colors.length]};color:${colors[i%colors.length]}"></span>${esc(p.name)}</div>`).join(''):'<div class="dim sb-empty">Aucun projet</div>';
    $$('.sb-proj-item').forEach(x=>x.addEventListener('click',()=>{currentProject=x.dataset.name;$('#proj-cur').textContent=x.dataset.name;nav('deployments');}));
  }catch(e){}
}
async function loadProjects(){
  try{const d=await api('GET','/api/projects');
    const g=$('#proj-grid');
    g.innerHTML=d.projects.length?d.projects.map(p=>`<div class="proj-card"><div class="proj-card-hd"><div class="proj-name">📦 ${esc(p.name)} <span class="fw-badge">${esc(p.framework||'?')}</span></div><span class="status ${p.status}">${p.status}</span></div><div class="proj-meta"><div class="row"><span>Port</span><span>${p.port||'—'}</span></div><div class="row"><span>v${p.version||1}</span><span>${p.created?new Date(p.created*1000).toLocaleString('fr-FR'):'—'}</span></div></div><div class="proj-url"><a href="http://127.0.0.1:8765/${encodeURIComponent(p.name)}/" target="_blank">${esc(p.name)}.nercel → :${p.port}</a></div></div>`).join(''):'<div class="dim pad">Aucun projet. Déploie ton premier zip ↑</div>';
  }catch(e){}
}

// ===================== SYSTEM (v6) =====================
async function loadSystem(){
  try{
    const s=await api('GET','/api/system');
    const gauges=[
      {l:'CPU',v:s.cpu,pct:s.cpu,c:'#22e07a'},{l:'RAM',v:s.ram,pct:s.ram,c:'#f5b945'},
      {l:'Requêtes',v:s.requests,pct:Math.min(100,(s.requests%500)/5),c:'#38bdf8'},
      {l:'Edge lat',v:s.edge_latency_ms+'ms',pct:Math.min(100,s.edge_latency_ms*8),c:'#a78bfa'},
    ];
    $('#sys-gauges').innerHTML=gauges.map((g,i)=>`<div class="gauge"><canvas class="gauge-ring" data-i="${i}"></canvas><div class="gauge-val">${esc(g.v)}</div><div class="gauge-label">${g.l}</div></div>`).join('');
    $$('#sys-gauges .gauge-ring').forEach((c,i)=>drawGauge(c,gauges[i].pct,gauges[i].c));
    $('#sys-regions').innerHTML=s.regions.map(r=>`<div class="region-row"><span class="region-code">${esc(r.code)}</span><span class="region-name">${esc(r.name)}</span><div class="region-load"><div class="region-load-fill" style="width:${r.load}%;background:${r.status==='active'?'var(--grad-cool)':'var(--yellow)'}"></div></div><span class="region-lat">${r.lat} ms</span></div>`).join('');
    drawSpark($('#sys-spark'),s.latency_series,'#a78bfa');
    $('#sys-lat-now').textContent=s.edge_latency_ms+' ms';
    $('#sys-kv').innerHTML=[['Connexions actives',s.active_conns],['SSE clients',s.sse_clients],['Logs buffer',s.log_events],['DB',s.db_size_kb+' KB']].map(([k,v])=>`<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    $('#sys-plat').innerHTML=[['Version','v10.0'],['Orchestrateur',':'+s.orch_port],['Edge NEXUS',':'+s.edge_port],['Uptime',Math.floor(s.uptime/60)+' min'],['Services',s.features+'/130'],['Users',s.users],['Agents',s.agents],['Projets',s.projects],['Déploiements',s.deploys],['Audit events',s.audits]].map(([k,v])=>`<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    const h=$('#sys-health');if(h)h.innerHTML='<span class="live-dot"></span> '+s.health;
  }catch(e){console.warn('system',e);}
}

// ===================== DEPLOYMENTS =====================
async function loadDeployments(){await loadProjects();
  try{const d=await api('GET','/api/deployments');
    const tb=$('#deploys-table tbody');
    tb.innerHTML=d.deployments.length?d.deployments.slice(0,20).map(x=>`<tr><td>${esc(x.project)}</td><td class="mono-sm">${esc(x.commit_hash)}</td><td>${esc(x.env)}</td><td><span class="status running">${esc(x.status)}</span></td><td>${(x.duration||0).toFixed(2)}s</td><td>${new Date(x.ts*1000).toLocaleString('fr-FR')}</td></tr>`).join(''):'<tr><td colspan="6" class="dim pad">Aucun déploiement</td></tr>';
  }catch(e){}
}
const dz=$('#dropzone');
dz&&dz.addEventListener('click',()=>$('file-input')&&$('#file-input').click());
$('#file-input')&&$('#file-input').addEventListener('change',e=>{if(e.target.files[0])deployZip(e.target.files[0]);});
['dragover','dragenter'].forEach(ev=>dz&&dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
['dragleave','drop'].forEach(ev=>dz&&dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
dz&&dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)deployZip(f);});
async function deployZip(file){
  if(!file.name.endsWith('.zip')){toast('Il faut un .zip','err');return;}
  const name=file.name.replace(/\.zip$/,'');const fd=new FormData();
  fd.append('file',file);fd.append('name',name);fd.append('env','Production');
  toast('Déploiement de '+name+'…');
  try{const d=await api('POST','/api/deploy',fd,true);toast(`✓ ${d.name} (${d.framework}) → :${d.port}`);loadProjects();loadStatus();loadDeployments();}
  catch(e){toast('Échec : '+e.message,'err');}
}
$('#new-deploy-btn').addEventListener('click',()=>{$('#deploy-modal').hidden=false;});
$('#dep-new')&&$('#dep-new').addEventListener('click',()=>{$('#deploy-modal').hidden=false;});
$('#deploy-x').addEventListener('click',()=>$('#deploy-modal').hidden=true);
$('#deploy-modal').addEventListener('click',e=>{if(e.target.id==='deploy-modal')$('#deploy-modal').hidden=true;});
const dzm=$('#dropzone-modal');
dzm&&dzm.addEventListener('click',()=>$('#file-input-modal').click());
$('#file-input-modal')&&$('#file-input-modal').addEventListener('change',e=>{if(e.target.files[0]){$('#deploy-modal').hidden=true;deployZip(e.target.files[0]);}});
['dragover','dragenter'].forEach(ev=>dzm&&dzm.addEventListener(ev,e=>{e.preventDefault();}));
dzm&&dzm.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){$('#deploy-modal').hidden=true;deployZip(f);}});

// ===================== LOGS (SSE) =====================
let logES=null;
function connectLogs(){try{logES=new EventSource(API+'/api/logs/stream');logES.onmessage=ev=>{try{pushLog(JSON.parse(ev.data));}catch(e){}};logES.onerror=()=>{try{logES.close();}catch(e){}};}catch(e){}}
function pushLog(l){
  const q=($('#log-search')||{}).value||'';const box=$('#log-box');if(!box)return;
  const txt=(l.msg||'').toLowerCase();
  if(q&&!(txt.includes(q.toLowerCase())||(l.level||'').includes(q)))return;
  const el=document.createElement('div');el.className='log-line '+(l.level||'info');
  el.innerHTML=`<span class="ts">${esc(l.ts||'')}</span><span class="lvl">${(l.level||'info').slice(0,4).toUpperCase()}</span><span>${esc(l.msg||'')}</span>`;
  box.appendChild(el);
  while(box.children.length>300)box.removeChild(box.firstChild);
  box.scrollTop=box.scrollHeight;
  $('#log-count').textContent=box.children.length+' lignes';
  const bl=$('#b-logs');bl.hidden=false;bl.textContent=Math.min(99,box.children.length);
}
$('#log-search')&&$('#log-search').addEventListener('input',()=>{const q=$('#log-search').value.toLowerCase();$$('.log-line').forEach(l=>{l.style.display=(!q||(l.textContent||'').toLowerCase().includes(q))?'':'none';});});

// ===================== EDGE & SECURITY =====================
async function loadEdge(){
  try{
    const st=await api('GET','/api/status');
    $('#edge-stats').innerHTML=[
      {l:'Edge port',v:':'+st.edge_port},{l:'Uptime',v:Math.floor(st.uptime/60)+' min'},
      {l:'Requêtes totales',v:st.requests},{l:'Services',v:st.features}
    ].map(s=>`<div class="stat"><div class="stat-label">${s.l}</div><div class="stat-val">${s.v}</div></div>`).join('');
    $('#edge-list').innerHTML=[
      ['NEXUS Edge','actif · 1.2 ms'],['Cache RAM','activé · LRU 128'],['Compression','Brotli/Gzip'],
      ['HTTP/3 (QUIC)','beta'],['CDN local','activé'],['Load Balancing','activé']
    ].map(([k,v])=>`<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    $('#sec-list').innerHTML=[
      ['Auth','PBKDF2 · 200k itér.'],['Sessions','token 7j'],['WAF','SQLi/XSS/traversal'],
      ['Rate limit','100/min/IP'],['Audit log','activé'],['SSL','Let\'s Encrypt (beta)']
    ].map(([k,v])=>`<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    const aud=await api('GET','/api/audit');
    $('#audit-table tbody').innerHTML=aud.audit.length?aud.audit.slice(0,20).map(a=>`<tr><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td class="mono-sm">${esc(a.target)}</td><td>${new Date(a.ts*1000).toLocaleString('fr-FR')}</td></tr>`).join(''):'<tr><td colspan="4" class="dim pad">Aucun événement</td></tr>';
  }catch(e){}
}

// ===================== AGENT BUILDER =====================
let templates=[],currentAgent=null;
async function loadAgents(){
  try{
    const d=await api('GET','/api/agents');templates=d.templates||[];
    const g=$('#agent-grid');
    g.innerHTML=d.agents.length?d.agents.map(a=>`<div class="agent-card ${currentAgent&&currentAgent.id===a.id?'active':''}" data-id="${a.id}"><div class="an">🤖 ${esc(a.name)}</div><div class="ad">${esc(a.description||'—')}</div><div class="am">${a.model} · ${a.persona}${a.public?' · public':''}</div></div>`).join(''):'<div class="dim pad">Aucun agent. Crée-en un →</div>';
    g.querySelectorAll('[data-id]').forEach(c=>c.addEventListener('click',()=>selectAgent(+c.dataset.id)));
    $('#tmpl-grid').innerHTML=templates.map((t,i)=>`<div class="tmpl-card" data-i="${i}"><div class="tn">${esc(t.name)}</div><div class="td">${esc(t.description)}</div></div>`).join('');
    $('#tmpl-grid').querySelectorAll('[data-i]').forEach(c=>c.addEventListener('click',()=>useTemplate(+c.dataset.i)));
  }catch(e){}
}
function useTemplate(i){const t=templates[i];if(!t)return;
  $('#agent-id').value='';currentAgent=null;
  $('#agent-name').value=t.name;$('#agent-desc').value=t.description;$('#agent-system').value=t.system;
  $('#agent-model').value=t.model;$('#agent-persona').value=t.persona;$('#agent-temp').value=0.7;$('#temp-val').textContent='0.7';
  $('#agent-public').checked=false;$('#editor-title').textContent='Nouvel agent';$('#editor-id').textContent='';$('#agent-endpoint').textContent='';
  toast('Template chargé — enregistre');
}
function selectAgent(id){
  api('GET','/api/agents/'+id).then(d=>{const ag=d.agent;if(!ag)return;currentAgent=ag;
    $('#agent-id').value=ag.id;$('#agent-name').value=ag.name;$('#agent-desc').value=ag.description||'';
    $('#agent-system').value=ag.system;$('#agent-model').value=ag.model;$('#agent-persona').value=ag.persona;
    $('#agent-temp').value=ag.temperature;$('#temp-val').textContent=ag.temperature;$('#agent-public').checked=!!ag.public;
    $('#editor-title').textContent=ag.name;$('#editor-id').textContent='#'+ag.id;
    $('#agent-endpoint').textContent=ag.public?`GET /api/agent/${ag.id}/ask?msg=…`:'(privé)';
    $('#agent-chat-box').innerHTML='<div class="chat-msg bot">Agent chargé. Teste-le 👇</div>';
    $$('.agent-card').forEach(c=>c.classList.toggle('active',+c.dataset.id===id));
  }).catch(e=>{});
}
$('#agent-temp').addEventListener('input',e=>$('#temp-val').textContent=e.target.value);
$('#agent-new').addEventListener('click',()=>{
  $('#agent-form').reset();$('#agent-id').value='';currentAgent=null;
  $('#agent-temp').value=0.7;$('#temp-val').textContent='0.7';
  $('#editor-title').textContent='Nouvel agent';$('#editor-id').textContent='';$('#agent-endpoint').textContent='';
  $$('.agent-card').forEach(c=>c.classList.remove('active'));
});
$('#agent-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const p={name:$('#agent-name').value.trim(),description:$('#agent-desc').value.trim(),system:$('#agent-system').value,
    model:$('#agent-model').value,persona:$('#agent-persona').value,temperature:+$('#agent-temp').value,public:$('#agent-public').checked};
  if(!p.name){toast('Nom requis','err');return;}
  const id=$('#agent-id').value;
  try{if(id){await api('POST','/api/agents/'+id+'/update',p);toast('✓ Agent mis à jour');}
    else{const d=await api('POST','/api/agents',p);$('#agent-id').value=d.id;currentAgent={id:d.id,...p};$('#editor-id').textContent='#'+d.id;toast('✓ Agent créé #'+d.id);}
    loadAgents();}catch(err){toast('Échec : '+err.message,'err');}
});
$('#agent-delete').addEventListener('click',async()=>{
  const id=$('#agent-id').value;if(!id){toast('Aucun agent sélectionné','err');return;}
  try{await api('POST','/api/agents/'+id+'/delete');toast('Agent supprimé');
    $('#agent-form').reset();$('#agent-id').value='';currentAgent=null;$('#editor-title').textContent='Constructeur d\'agent';$('#editor-id').textContent='';loadAgents();}
  catch(e){toast('Échec : '+e.message,'err');}
});
$('#agent-chat-form').addEventListener('submit',async e=>{
  e.preventDefault();const id=$('#agent-id').value;const inp=$('#agent-chat-input');const txt=inp.value.trim();if(!txt||!id)return;
  const box=$('#agent-chat-box');
  const u=document.createElement('div');u.className='chat-msg user';u.textContent=txt;box.appendChild(u);inp.value='';
  const ld=document.createElement('div');ld.className='chat-msg bot loading';box.appendChild(ld);box.scrollTop=box.scrollHeight;
  try{const d=await api('POST','/api/agents/'+id+'/chat',{messages:[{role:'user',content:txt}]});ld.remove();
    const b=document.createElement('div');b.className='chat-msg bot';
    if(d.image)b.innerHTML=`<img src="${d.image}" style="max-width:100%;border-radius:7px">`;else b.innerHTML=mdToHtml(d.reply);
    box.appendChild(b);}catch(err){ld.remove();const b=document.createElement('div');b.className='chat-msg bot';b.textContent='Erreur : '+err.message;box.appendChild(b);}
  box.scrollTop=box.scrollHeight;
});

// ===================== IA =====================
$('#chat-form').addEventListener('submit',async e=>{
  e.preventDefault();const inp=$('#chat-input');const txt=inp.value.trim();if(!txt)return;
  const box=$('#chat-box');const u=document.createElement('div');u.className='chat-msg user';u.textContent=txt;box.appendChild(u);inp.value='';
  const ld=document.createElement('div');ld.className='chat-msg bot loading';box.appendChild(ld);box.scrollTop=box.scrollHeight;
  const model=($('#chat-model-sel')||{}).value||undefined;
  try{const d=await api('POST','/api/ai/chat',{messages:[{role:'user',content:txt}],model});ld.remove();
    const b=document.createElement('div');b.className='chat-msg bot';b.innerHTML=mdToHtml(d.reply);box.appendChild(b);}
  catch(err){ld.remove();const b=document.createElement('div');b.className='chat-msg bot';b.textContent='Erreur : '+err.message;box.appendChild(b);}
  box.scrollTop=box.scrollHeight;
});
$('#img-form').addEventListener('submit',async e=>{
  e.preventDefault();const p=$('#img-prompt').value.trim();if(!p)return;const g=$('#img-gallery');
  if(g.querySelector('.dim'))g.innerHTML='';
  const btn=e.target.querySelector('button');btn.disabled=true;btn.textContent='Génération…';
  const c=document.createElement('div');c.style.cssText='grid-column:1/-1;text-align:center;color:var(--text3);padding:18px';c.textContent='🎨 génération…';g.prepend(c);
  try{const d=await api('GET','/api/ai/image?prompt='+encodeURIComponent(p));c.remove();
    const img=document.createElement('img');img.src=d.image;img.alt=p;img.loading='lazy';g.prepend(img);toast('✓ image générée');}
  catch(err){c.textContent='Erreur : '+err.message;toast('Échec','err');}
  finally{btn.disabled=false;btn.textContent='Générer';}
});

// ===================== GITHUB =====================
$('#gh-connect-form').addEventListener('submit',async e=>{
  e.preventDefault();const t=$('#gh-token').value.trim();if(!t)return;
  try{const d=await api('POST','/api/github/connect',{token:t});toast(`✓ GitHub : ${d.github.login}`);$('#gh-token').value='';loadGithub();}
  catch(err){const el=$('#gh-connect-err');el.textContent='Token invalide : '+err.message;el.hidden=false;}
});
$('#gh-disconnect').addEventListener('click',async()=>{try{await api('POST','/api/github/disconnect');toast('GitHub déconnecté');loadGithub();}catch(e){}});
async function loadGithub(){
  try{const d=await api('GET','/api/github/status');
    if(d.connected){$('#gh-connect-panel').hidden=true;$('#gh-connected').hidden=false;$('#gh-login').textContent=d.github.name||d.github.login;loadRepos();}
    else{$('#gh-connect-panel').hidden=false;$('#gh-connected').hidden=true;}}
  catch(e){}
}
async function loadRepos(){
  try{const d=await api('GET','/api/github/repos');const g=$('#repo-grid');
    g.innerHTML=d.repos.length?d.repos.map(r=>`<div class="repo-card"><div class="repo-name">${r.private?'🔒':''} ${esc(r.name)} ${r.private?'<span class="repo-private">privé</span>':''}</div><div class="repo-lang">${esc(r.lang||'—')} · ⭐ ${r.stars}</div><div class="repo-actions"><span class="repo-stars">${new Date(r.updated).toLocaleDateString('fr-FR')}</span><button class="btn-secondary" data-repo="${esc(r.url)}" data-name="${esc(r.name)}">Déployer</button></div></div>`).join(''):'<div class="dim pad">Aucun dépôt</div>';
    g.querySelectorAll('[data-repo]').forEach(b=>b.addEventListener('click',async()=>{
      b.disabled=true;b.textContent='Clone…';
      try{const d=await api('POST','/api/github/deploy',{repo_url:b.dataset.repo,name:b.dataset.name});toast(`✓ ${d.name} (${d.framework}) → :${d.port}`);loadProjects();loadStatus();}
      catch(e){toast('Échec : '+e.message,'err');}finally{b.disabled=false;b.textContent='Déployer';}
    }));}catch(e){$('#repo-grid').innerHTML='<div class="dim pad">Erreur</div>';}
}

// ===================== SETTINGS =====================
async function loadSettings(){
  try{const st=await api('GET','/api/status');
    $('#settings-profile').innerHTML=[['Identifiant',me.username],['Email',me.email||'—'],['Plan',me.plan||'free'],['Rôle','admin'],['ID',me.id]].map(([k,v])=>`<div class="kv"><span class="k">${k}</span><span class="v">${esc(String(v))}</span></div>`).join('');
    $('#settings-plat').innerHTML=[['Version','v10.0'],['Options','200'],['Services',st.features+'/130'],['Edge',':'+st.edge_port],['Orchestrateur',':3923'],['Uptime',Math.floor(st.uptime/60)+' min'],['Données','~/.nercel/']].map(([k,v])=>`<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    const su=$('#set-user');if(su)su.textContent=me.username;
    loadOptions();
  }catch(e){}
}

// ===================== OPTIONS (registre 200) =====================
let OPTS=[], OPT_CAT=[];
function optField(o){
  const v=o.secret&&o.value?'••••':o.value;
  if(o.type==='bool')return `<label class="opt-check"><input type="checkbox" data-k="${o.key}" ${o.value?'checked':''}></label>`;
  if(o.type==='choice')return `<select data-k="${o.key}">${(o.choices||[]).map(c=>`<option ${c===o.value?'selected':''}>${c}</option>`).join('')}</select>`;
  if(o.type==='int')return `<input type="number" data-k="${o.key}" value="${v}" min="${o.min??''}" max="${o.max??''}">`;
  if(o.type==='color')return `<input type="color" data-k="${o.key}" value="${v}">`;
  return `<input type="text" data-k="${o.key}" value="${esc(String(v))}" ${o.secret?'type="password"':''}>`;
}
async function loadOptions(filter=''){
  try{
    if(!OPTS.length){const d=await api('GET','/api/config');OPTS=d.options||[];OPT_CAT=d.categories||[];}
    $('#opt-count').textContent=OPTS.length;
    const f=filter.trim().toLowerCase();
    const opts=f?OPTS.filter(o=>o.key.includes(f)||o.category.includes(f)):OPTS;
    let html='',cat=null;
    for(const o of opts){
      if(o.category!==cat){cat=o.category;html+=`<div class="opt-cat">${cat}</div>`;}
      const choices=o.choices?`<span class="opt-meta">${o.choices.length} choix</span>`:'';
      html+=`<div class="opt-row"><div class="opt-key"><b>${o.key}</b><span class="opt-desc">${esc(o.desc)}</span></div><div class="opt-val">${optField(o)}${choices}</div></div>`;
    }
    $('#opt-tree').innerHTML=html||'<div class="dim">Aucune option ne correspond.</div>';
    $$('#opt-tree [data-k]').forEach(el=>{
      el.addEventListener('change',async()=>{
        const v=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
        const r=await api('POST','/api/config',{key:el.dataset.k,value:v});
        if(r.ok){toast(r.message||'ok');el.style.outline='2px solid var(--ok, #3ecf8e)';}
        else{toast(r.message||'échec','err');el.style.outline='2px solid var(--err, #ff5c5c)';}
        setTimeout(()=>el.style.outline='',700);
        // recharger les valeurs depuis le serveur
        OPTS=[];loadOptions('');
      });
    });
  }catch(e){console.warn('options',e);}
}
$('#logout-btn')&&$('#logout-btn').addEventListener('click',async()=>{
  try{await api('POST','/api/auth/logout');}catch(e){}
  try{logES&&logES.close();}catch(e){}
  me=null;location.reload();
});


// ===================== AI HUB (v10) =====================
async function loadAIHub(){
  try{
    const d=await api('GET','/api/ai/providers');
    const lm=d.local_models||[];
    $('#aihub-stats').innerHTML=[
      {l:'IA totales',v:(d.total_cloud+10)},
      {l:'Cloud keyless',v:d.total_cloud},
      {l:'Runtimes locaux',v:d.total_local_runtimes},
      {l:'Modèles locaux actifs',v:lm.length},
      {l:'Ollama',v:d.ollama_installed?'en ligne':(d.ollama_bin?'installé':'absent')},
    ].map(s=>`<div class="stat"><div class="stat-label">${s.l}</div><div class="stat-val">${s.v}</div></div>`).join('');
    $('#b-aihub').textContent=d.total_cloud+10;
    $('#aihub-local-count').textContent=lm.length?`${lm.length} modèle(s)`:'0 détecté';
    $('#aihub-local').innerHTML=(d.local||[]).map(r=>`
      <div class="kv"><span class="k">${r.alive?'🟢':'⚪'} ${esc(r.name)}</span><span class="v mono-sm">${r.base}</span></div>
      <div class="dim" style="font-size:.78rem;margin:-6px 0 8px">${esc(r.note)}</div>`).join('')+
      (lm.length?`<div class="opt-cat">Modèles détectés</div>`+lm.map(m=>`<div class="kv"><span class="k mono-sm">${esc(m.id)}</span><span class="v">${esc(m.runtime)}</span></div>`).join(''):'');
    $('#aihub-cloud-count').textContent=d.total_cloud;
    const provs={};
    (d.cloud||[]).forEach(c=>{provs[c.provider]=(provs[c.provider]||0)+1;});
    let html='';
    for(const[prov,n]of Object.entries(provs)){
      const models=(d.cloud||[]).filter(c=>c.provider===prov);
      html+=`<div class="opt-cat">${prov==='pollinations'?'Pollinations':'DuckDuckGo AI'} — ${n} modèles</div>`;
      html+=models.map(m=>`<div class="kv"><span class="k mono-sm">${esc(m.id)}</span><span class="v dim">${esc(m.desc||'')}</span></div>`).join('');
    }
    $('#aihub-cloud').innerHTML=html;
    const chip=$('#aihub-ollama-chip');
    if(chip)chip.textContent=d.ollama_installed?'en ligne :11434':(d.ollama_bin?'installé, service arrêté':'non installé');
    // sélecteur de modèles dans le chat IA
    const sel=$('#chat-model-sel');
    if(sel&&sel.options.length<=1){
      lm.forEach(m=>sel.add(new Option('🖥 '+m.id,m.id)));
      (d.cloud||[]).slice(0,12).forEach(m=>sel.add(new Option('☁ '+m.id,m.id)));
    }
  }catch(e){console.warn('aihub',e);}
}
$('#aihub-refresh')&&$('#aihub-refresh').addEventListener('click',()=>{loadAIHub();toast('Re-scan des fournisseurs…');});

// ===================== SCAFFOLDS (v10) =====================
let SCAFFOLDS=[];
async function loadScaffolds(){
  try{
    const d=await api('GET','/api/scaffolds');
    SCAFFOLDS=d.scaffolds||[];
    const sel=$('#scaffold-template');
    sel.innerHTML=SCAFFOLDS.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    const upd=()=>{const s=SCAFFOLDS.find(x=>x.id===sel.value);$('#scaffold-desc').textContent=s?`${s.desc} — ${s.files} fichiers · framework ${s.framework}`:'—';};
    sel.addEventListener('change',upd);upd();
    $('#scaffold-grid').innerHTML=SCAFFOLDS.map(s=>`
      <div class="scaffold-card"><div class="sc-hd"><span class="sc-ic">${s.id==='nextjs'?'▲':s.id==='react-vite'?'⚡':s.id==='express'?'🚂':s.id==='flask'?'🐍':s.id==='fastapi'?'🍃':'📄'}</span><b>${esc(s.name)}</b><span class="chip">${s.framework}</span></div>
      <div class="sc-desc">${esc(s.desc)}</div>
      <div class="sc-meta">${s.files} fichiers</div>
      <button class="btn-primary sc-btn" data-t="${s.id}">Générer + déployer</button></div>`).join('');
    $$('#scaffold-grid .sc-btn').forEach(b=>b.addEventListener('click',()=>scaffoldDeploy(b.dataset.t)));
  }catch(e){console.warn('scaffolds',e);}
}
async function scaffoldDeploy(tpl){
  const name=($('#scaffold-name').value.trim())||('projet-'+Date.now().toString(36));
  toast('Génération '+tpl+' → '+name+'…');
  try{
    const d=await api('POST','/api/scaffold',{template:tpl,name});
    toast(`✓ ${d.name} (${d.framework||d.template}) → :${d.port}`);
    loadProjects();loadStatus();
  }catch(e){toast('Échec : '+e.message,'err');}
}
$('#scaffold-form')&&$('#scaffold-form').addEventListener('submit',e=>{e.preventDefault();const t=$('#scaffold-template').value;scaffoldDeploy(t);});

// ===================== DEVOPS PAGE (v10) =====================
async function loadDevOpsPage(){
  try{
    const st=await api('GET','/api/status');
    const names=st.projects.map(p=>p.name);
    ['hooks-proj-sel','gen-proj-sel','env-proj-sel'].forEach(id=>{
      const sel=document.getElementById(id);if(!sel)return;
      const cur=sel.value;
      sel.innerHTML='<option value="">— choisir un projet —</option>'+names.map(n=>`<option ${n===cur?'selected':''}>${esc(n)}</option>`).join('');
    });
    fillHooks();fillGen();fillEnv();
  }catch(e){console.warn('devops',e);}
}
async function fillHooks(){
  const n=$('#hooks-proj-sel').value;
  $('#hooks-proj-chip').textContent=n||'—';
  if(!n){$('#hooks-list').innerHTML='<div class="dim pad">Choisis un projet.</div>';return;}
  try{
    const d=await api('GET','/api/hooks/'+encodeURIComponent(n));
    const H=d.hooks||{};
    $('#hooks-list').innerHTML=d.types.map(t=>`
      <div class="kv"><span class="k">${H[t]?'🟢':'⚪'} ${t}</span><span class="v mono-sm" style="font-size:.72rem">${H[t]?esc(H[t]):'—'}</span></div>`).join('');
  }catch(e){$('#hooks-list').innerHTML='<div class="dim pad">Erreur</div>';}
}
async function fillGen(){
  const n=$('#gen-proj-sel').value;
  if(!n){$('#gen-grid').innerHTML='<div class="dim pad">Choisis un projet.</div>';return;}
  try{
    const d=await api('GET','/api/generators');
    $('#gen-grid').innerHTML=(d.generators||[]).map(g=>`
      <div class="gen-card"><div class="gc-name">${esc(g.name)}</div><div class="gc-desc">${esc(g.desc)}</div>
      <button class="btn-secondary gc-btn" data-k="${g.id}">Générer</button></div>`).join('');
    $$('#gen-grid .gc-btn').forEach(b=>b.addEventListener('click',async()=>{
      b.disabled=true;b.textContent='…';
      try{const r=await api('POST','/api/generate',{kind:b.dataset.k,name:n});toast(`✓ ${r.file} généré (${r.size} o)`);}
      catch(e){toast('Échec : '+e.message,'err');}
      finally{b.disabled=false;b.textContent='Générer';}
    }));
  }catch(e){console.warn('gen',e);}
}
async function fillEnv(){
  const n=$('#env-proj-sel').value;
  $('#env-proj-chip').textContent=n||'—';
  if(!n){$('#env-list').innerHTML='<div class="dim pad">Choisis un projet.</div>';return;}
  try{
    const d=await api('GET','/api/env/'+encodeURIComponent(n));
    const E=d.env||{};
    $('#env-list').innerHTML=Object.keys(E).length?Object.entries(E).map(([k,v])=>`<div class="kv"><span class="k mono-sm">${esc(k)}</span><span class="v mono-sm">${esc(v)}</span></div>`).join(''):'<div class="dim pad">Aucune variable — ajoute-en une ↓</div>';
  }catch(e){$('#env-list').innerHTML='<div class="dim pad">Erreur</div>';}
}
$('#hooks-proj-sel')&&$('#hooks-proj-sel').addEventListener('change',fillHooks);
$('#gen-proj-sel')&&$('#gen-proj-sel').addEventListener('change',fillGen);
$('#env-proj-sel')&&$('#env-proj-sel').addEventListener('change',fillEnv);
$('#env-form')&&$('#env-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const n=$('#env-proj-sel').value,k=$('#env-key').value.trim(),v=$('#env-val').value.trim();
  if(!n||!k){toast('Choisis un projet et une clé','err');return;}
  try{
    const cur=await api('GET','/api/env/'+encodeURIComponent(n));
    const env={...(cur.env||{}),[k]:v};
    await api('POST','/api/env/'+encodeURIComponent(n),{env});
    toast('✓ '+k+' ajouté (redéploie pour appliquer)');
    $('#env-key').value='';$('#env-val').value='';fillEnv();
  }catch(err){toast('Échec : '+err.message,'err');}
});

// ===================== POLLING =====================
function startPolling(){
  if(analyticsTimer)clearInterval(analyticsTimer);
  analyticsTimer=setInterval(()=>{
    if(!me)return;
    const active=$('.page.active');
    if(active&&active.id==='page-analytics')loadAnalytics();
    if(active&&active.id==='page-system')loadSystem();
    if(active&&active.id==='page-overview')loadOverview();
    loadStatus();
  },8000);
}
// redraw charts on resize
let _rt;window.addEventListener('resize',()=>{clearTimeout(_rt);_rt=setTimeout(()=>{
  if($('.page.active')&&$('.page.active').id==='page-analytics')loadAnalytics();
  if($('.page.active')&&$('.page.active').id==='page-system')loadSystem();
},200);});

// ===================== BOOT =====================
(async function boot(){
  setAuthTabs();
  try{const d=await api('GET','/api/auth/me');if(d.user){me=d.user;enterApp();}else $('#auth-screen').style.display='flex';}
  catch(e){$('#auth-screen').style.display='flex';}
})();
