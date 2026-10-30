#!/usr/bin/env node
'use strict';
/* GENT — Node 22 Premium Founder Edition
   IDE-lite souverain · 100 % stdlib · exécution sandbox (permission model)
   Accès local uniquement · API protégée par jeton d'instance.               */
const http = require('node:http');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const GENT_HOME = process.env.GENT_HOME || path.join(os.homedir(), 'gent');
const WORKSPACE = path.join(GENT_HOME, 'workspace');
const RUNS_DIR  = path.join(WORKSPACE, '.gent-runs');
const PORT = Number(process.env.PORT || 4310);
const HOST = process.env.GENT_HOST || '127.0.0.1';
const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const MAX_BODY = 256 * 1024, MAX_OUT = 64 * 1024, MAX_READ = 512 * 1024;
const BOOT = Date.now();

function loadIdentity() {
  try {
    return JSON.parse(fs.readFileSync(path.join(GENT_HOME, 'identity', 'instance.json'), 'utf8'));
  } catch (e) {
    return { instance_id: 'GENT-UNREGISTERED', build_id: 'dev', auth_token: 'dev-token' };
  }
}
const ID = loadIdentity();
const TOKEN = String(process.env.GENT_TOKEN || ID.auth_token || '');

function json(res, code, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Gent-Instance': ID.instance_id
  });
  res.end(b);
}
function inside(base, p) {
  const t = path.resolve(base, p || '.');
  return (t === base || t.startsWith(base + path.sep)) ? t : null;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', d => { n += d.length; if (n > MAX_BODY) { reject(new Error('corps trop volumineux')); req.destroy(); } else chunks.push(d); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const PAGE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GENT · Node 22 Premium Founder Edition</title>
<style>
:root{--bg:#050507;--panel:#0b0b10;--line:#1e1e28;--txt:#eaeaf0;--dim:#8b8b98;--acc1:#7c5cff;--acc2:#00d4ff;--ok:#2ecc71}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100vh;display:flex;flex-direction:column}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 22px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#0d0d14,#08080c);gap:12px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--ok);box-shadow:0 0 12px var(--ok);animation:pulse 2s infinite}
@keyframes pulse{50%{opacity:.4}}
.name{font-weight:800;letter-spacing:.18em;font-size:15px;background:linear-gradient(90deg,var(--acc1),var(--acc2));-webkit-background-clip:text;background-clip:text;color:transparent}
.tag{color:var(--dim);font-size:11px;letter-spacing:.14em}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{border:1px solid var(--line);background:#0e0e15;border-radius:999px;padding:4px 12px;font-size:11px;color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace}
main{flex:1;display:grid;grid-template-columns:minmax(300px,420px) 1fr;gap:16px;padding:18px 22px;max-width:1400px;width:100%;margin:0 auto}
.col{display:flex;flex-direction:column;gap:16px;min-width:0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.35)}
.card.grow{flex:1;display:flex;flex-direction:column}
h2{font-size:11px;letter-spacing:.2em;color:var(--dim);text-transform:uppercase;margin-bottom:12px}
.metrics{display:grid;grid-template-columns:1fr;gap:6px}
.kv{display:flex;justify-content:space-between;border-bottom:1px dashed #16161e;padding:5px 0;font-size:13px;gap:10px}
.kv span{color:var(--dim)}
.kv b{font-family:ui-monospace,monospace;font-weight:600;text-align:right}
textarea{width:100%;min-height:320px;flex:1;background:#07070b;color:#d6e2ff;border:1px solid var(--line);border-radius:10px;padding:12px;font:13px/1.55 ui-monospace,Menlo,Consolas,monospace;resize:vertical}
textarea:focus{outline:1px solid var(--acc1)}
input{background:#07070b;border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 10px;font:12px ui-monospace,monospace;width:100%}
input:focus{outline:1px solid var(--acc1)}
.toolbar{display:flex;gap:8px;margin-bottom:10px}
.actions{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}
button{cursor:pointer;border:1px solid var(--line);background:#101018;color:var(--txt);border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:600;transition:.15s}
button:hover{border-color:var(--acc1);box-shadow:0 0 14px rgba(124,92,255,.25)}
button.primary{background:linear-gradient(90deg,var(--acc1),#5a7bff);border:none}
button.danger:hover{border-color:#ff5c5c}
pre{background:#07070b;border:1px solid var(--line);border-radius:10px;padding:12px;min-height:110px;max-height:300px;overflow:auto;font:12.5px/1.5 ui-monospace,monospace;white-space:pre-wrap;color:#b9f6d1}
.files{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow:auto}
.f{padding:6px 8px;border-radius:7px;cursor:pointer;font-family:ui-monospace,monospace;font-size:12px}
.f:hover{background:#12121b}
.f i{color:var(--dim);font-style:normal;margin-left:8px;font-size:11px}
footer{border-top:1px solid var(--line);padding:10px 22px;color:var(--dim);font-size:11px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-family:ui-monospace,monospace}
@media(max-width:900px){main{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
 <div class="brand"><span class="dot"></span><span class="name">GENT</span><span class="tag">NODE 22 · PREMIUM FOUNDER EDITION</span></div>
 <div class="chips"><span class="chip" id="chip-instance">__INSTANCE__</span><span class="chip" id="chip-build">build __BUILD__</span><span class="chip" id="chip-node">Node __NODEVER__ · PFE</span></div>
</header>
<main>
 <section class="col">
  <div class="card"><h2>Runtime souverain</h2><div class="metrics" id="metrics"></div></div>
  <div class="card"><h2>Workspace</h2><div class="toolbar"><input id="path" placeholder="sous-dossier (optionnel)"><button id="btn-refresh">Actualiser</button></div><div class="files" id="files"></div></div>
 </section>
 <section class="col">
  <div class="card grow"><h2>Éditeur · exécution sandbox (modèle de permission Node 22)</h2>
   <input id="file" placeholder="chemin/relatif.js">
   <textarea id="editor" spellcheck="false">// GENT — sandbox Node 22
console.log("GENT", process.version);
console.log("2+3 =", 2 + 3);</textarea>
   <div class="actions"><button id="btn-run" class="primary">▶ Exécuter</button><button id="btn-save">Enregistrer</button><button id="btn-load">Charger</button><button id="btn-del" class="danger">Supprimer</button></div>
   <pre id="out">Prêt.</pre>
  </div>
 </section>
</main>
<footer><span>127.0.0.1:__PORT__ · accès local uniquement · API protégée par jeton d’instance</span><span id="uptime"></span></footer>
<script>
var T = "__TOKEN__";
var $ = function(id){ return document.getElementById(id); };
function out(s){ $("out").textContent = s; }
function fmt(b){ if(b>1048576) return (b/1048576).toFixed(1)+" Mo"; if(b>1024) return (b/1024).toFixed(1)+" Ko"; return b+" o"; }
function api(m,p,b){ return fetch(p,{method:m,headers:{"X-Gent-Token":T,"Content-Type":"application/json"},body:b?JSON.stringify(b):undefined}).then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }).catch(function(){ return {ok:r.ok,j:{}}; }); }); }
function info(){ api("GET","/api/info").then(function(x){ if(!x.ok) return; var j=x.j;
  $("chip-instance").textContent = j.identity.instance_id;
  $("chip-build").textContent = "build " + j.identity.build_id;
  $("chip-node").textContent = "Node " + j.node.version + " · PFE";
  var rows = [["Plateforme", j.platform+" / "+j.arch],["Moteur V8", j.versions.v8],["OpenSSL", j.versions.openssl],["libuv", j.versions.uv],["CPUs", String(j.cpus)],["Mémoire libre", fmt(j.freemem)],["Charge 1/5/15", j.loadavg.map(function(v){return v.toFixed(2);}).join(" / ")],["Uptime process", j.proc_uptime_s+" s"],["Sandbox", j.workspace.sandbox]];
  $("metrics").innerHTML = rows.map(function(r){ return "<div class=kv><span>"+r[0]+"</span><b>"+r[1]+"</b></div>"; }).join("");
}); }
function files(d){ api("GET","/api/files?p="+encodeURIComponent(d||"")).then(function(x){ if(!x.ok) return; var j=x.j;
  var html = j.entries.map(function(e){ return '<div class=f data-p="'+e.p+'">'+(e.type==="d"?"▸ ":"· ")+e.name+(e.type==="f"?"<i>"+fmt(e.size)+"</i>":"")+'</div>'; }).join("");
  $("files").innerHTML = html || '<div class=f style="color:#8b8b98">(workspace vide)</div>';
  var els = document.querySelectorAll("#files .f");
  for (var i=0;i<els.length;i++){ els[i].onclick = function(){ var p=this.getAttribute("data-p"); $("file").value=p; load(); }; }
}); }
function load(){ var p=$("file").value; if(!p) return; api("GET","/api/read?p="+encodeURIComponent(p)).then(function(x){ if(x.ok){ $("editor").value=x.j.content; out("Chargé : "+p+" ("+fmt(x.j.bytes)+")"); } else out("Erreur : "+(x.j.error||"?")); }); }
function save(){ var p=$("file").value; if(!p){ out("Indique un chemin de fichier."); return; } api("POST","/api/write",{p:p,content:$("editor").value}).then(function(x){ if(x.ok){ out("Enregistré : "+p+" · sha256 "+x.j.sha256.slice(0,24)+"…"); files(); } else out("Erreur : "+(x.j.error||"?")); }); }
function del(){ var p=$("file").value; if(!p) return; api("POST","/api/delete",{p:p}).then(function(x){ if(x.ok){ out("Supprimé : "+p); $("editor").value=""; $("file").value=""; files(); } else out("Erreur : "+(x.j.error||"?")); }); }
function run(){ out("Exécution…"); api("POST","/api/run",{code:$("editor").value}).then(function(x){ var parts=[]; if(x.j.stdout) parts.push(x.j.stdout); if(x.j.stderr) parts.push(x.j.stderr); if(x.ok) parts.push("[exit "+x.j.code+" · "+x.j.ms+" ms]"); out(parts.join("\\n") || "(aucune sortie)"); }); }
$("btn-run").onclick=run; $("btn-save").onclick=save; $("btn-load").onclick=load; $("btn-del").onclick=del;
$("btn-refresh").onclick=function(){ files($("path").value); $("path").value=""; };
info(); files();
setInterval(function(){ fetch("/api/health").then(function(r){return r.json();}).then(function(j){ $("uptime").textContent="uptime "+(j.uptime_s|0)+" s · instance "+j.instance_id; }); }, 1000);
</script>
</body>
</html>
`;

function page() {
  return PAGE
    .replace('__INSTANCE__', ID.instance_id)
    .replace('__BUILD__', ID.build_id || 'dev')
    .replace('__NODEVER__', process.version)
    .replace('__TOKEN__', TOKEN)
    .replace('__PORT__', String(PORT));
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    const p = u.pathname;

    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      const h = page();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(h);
    }
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (p === '/api/health') {
      return json(res, 200, { status: 'ok', uptime_s: Math.floor((Date.now() - BOOT) / 1000), version: process.version, instance_id: ID.instance_id });
    }

    // ——— au-delà de ce point : jeton d'instance obligatoire ———
    if (!TOKEN || req.headers['x-gent-token'] !== TOKEN) {
      return json(res, 401, { error: "jeton d'instance requis (en-tête X-Gent-Token)" });
    }

    if (p === '/api/info') {
      let n = 0;
      try { n = (await fsp.readdir(WORKSPACE)).length; } catch (e) {}
      return json(res, 200, {
        node: { version: process.version, edition: 'Premium Founder Edition', exec: process.execPath },
        versions: { v8: process.versions.v8, openssl: process.versions.openssl, uv: process.versions.uv },
        platform: process.platform, arch: process.arch,
        cpus: os.cpus().length, loadavg: os.loadavg(),
        freemem: os.freemem(), totalmem: os.totalmem(), os_uptime: os.uptime(),
        proc_uptime_s: Math.floor((Date.now() - BOOT) / 1000),
        memory_rss: process.memoryUsage().rss,
        identity: { instance_id: ID.instance_id, build_id: ID.build_id || null, created: ID.created || null },
        workspace: { path: WORKSPACE, entries: n, sandbox: NODE_MAJOR >= 20 ? 'permission-model' : 'none' }
      });
    }

    if (p === '/api/files') {
      const dir = inside(WORKSPACE, u.searchParams.get('p') || '.');
      if (!dir) return json(res, 400, { error: 'chemin refusé (sortie du workspace)' });
      const es = await fsp.readdir(dir, { withFileTypes: true });
      const out = [];
      for (const e of es) {
        if (e.name.startsWith('.')) continue;
        const s = await fsp.stat(path.join(dir, e.name)).catch(() => null);
        out.push({ name: e.name, type: e.isDirectory() ? 'd' : 'f', size: s ? s.size : 0, mtime: s ? s.mtime.toISOString() : null, p: path.relative(WORKSPACE, path.join(dir, e.name)) });
      }
      out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'd' ? -1 : 1)));
      return json(res, 200, { path: path.relative(WORKSPACE, dir) || '.', entries: out });
    }

    if (p === '/api/read') {
      const f = inside(WORKSPACE, u.searchParams.get('p') || '');
      if (!f) return json(res, 400, { error: 'chemin refusé (sortie du workspace)' });
      const buf = await fsp.readFile(f).catch(() => null);
      if (!buf) return json(res, 404, { error: 'fichier introuvable' });
      if (buf.length > MAX_READ) return json(res, 413, { error: 'fichier trop volumineux (>512 Ko)' });
      if (buf.includes(0)) return json(res, 415, { error: 'fichier binaire non supporté' });
      return json(res, 200, { p: u.searchParams.get('p'), bytes: buf.length, content: buf.toString('utf8') });
    }

    if (p === '/api/write' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const f = inside(WORKSPACE, String(b.p || ''));
      if (!f || !b.p) return json(res, 400, { error: 'chemin refusé (sortie du workspace)' });
      await fsp.mkdir(path.dirname(f), { recursive: true });
      const content = String(b.content == null ? '' : b.content);
      await fsp.writeFile(f, content, { encoding: 'utf8', mode: 0o600 });
      const sha = crypto.createHash('sha256').update(content).digest('hex');
      return json(res, 200, { p: b.p, bytes: Buffer.byteLength(content), sha256: sha });
    }

    if (p === '/api/delete' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const f = inside(WORKSPACE, String(b.p || ''));
      if (!f || !b.p || f === WORKSPACE) return json(res, 400, { error: 'chemin refusé' });
      await fsp.rm(f, { recursive: true, force: true });
      return json(res, 200, { deleted: b.p });
    }

    if (p === '/api/run' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const code = String(b.code || '');
      if (!code.trim()) return json(res, 400, { error: 'code vide' });
      await fsp.mkdir(RUNS_DIR, { recursive: true });
      const rid = crypto.randomBytes(6).toString('hex');
      const file = path.join(RUNS_DIR, 'run-' + rid + '.js');
      await fsp.writeFile(file, code, { mode: 0o600 });
      const t0 = Date.now();
      const sandboxed = NODE_MAJOR >= 20;
      const args = sandboxed
        ? ['--permission', '--allow-fs-read=' + file, '--allow-fs-read=' + WORKSPACE, file]
        : [file];
      const child = spawn(process.execPath, args, {
        cwd: WORKSPACE,
        env: { PATH: '/usr/bin:/bin', HOME: WORKSPACE, GENT_SANDBOX: '1' },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let so = '', se = '', done = false;
      const timer = setTimeout(() => {
        if (!done) { try { child.kill('SIGKILL'); se += '\n[interrompu : délai de 6 s dépassé]'; } catch (e) {} }
      }, 6000);
      child.stdout.on('data', d => { if (so.length < MAX_OUT) so += d.toString('utf8'); });
      child.stderr.on('data', d => { if (se.length < MAX_OUT) se += d.toString('utf8'); });
      child.on('error', e => { se += String(e.message || e); });
      child.on('close', c => {
        if (done) return; done = true; clearTimeout(timer);
        fsp.rm(file, { force: true }).catch(() => {});
        return json(res, 200, { code: c, stdout: so.slice(0, MAX_OUT), stderr: se.slice(0, MAX_OUT), ms: Date.now() - t0, sandbox: sandboxed });
      });
      return;
    }

    return json(res, 404, { error: 'route inconnue' });
  } catch (e) {
    return json(res, 500, { error: String((e && e.message) || e) });
  }
});

if (process.env.GENT_WARMUP === '1') {
  console.log('[gent] warmup compile-cache ' + process.version + ' → ' + (process.env.NODE_COMPILE_CACHE || '(off)'));
  process.exit(0);
}

server.listen(PORT, HOST, () => {
  console.log('[gent] PFE en ligne — http://' + HOST + ':' + PORT + ' · instance ' + ID.instance_id + ' · node ' + process.version);
});
server.on('error', e => { console.error('[gent] ERREUR : ' + e.message); process.exit(2); });
