#!/usr/bin/env node
'use strict';
/* GENT — Node 22 Premium Founder Edition · BUILD VISION
   IDE souverain 3 panneaux : Éditeur | Terminal de build | Live Preview
   Validation "zéro erreur" sans exécuter : AST (V8) → lint stdlib → node --check
   100 % stdlib · accès local · API protégée par jeton d'instance.            */
const http = require('node:http');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { spawn } = require('node:child_process');

const GENT_HOME = process.env.GENT_HOME || path.join(os.homedir(), 'gent');
const WORKSPACE = path.join(GENT_HOME, 'workspace');
const RUNS_DIR  = path.join(WORKSPACE, '.gent-runs');
const PORT = Number(process.env.PORT || 4310);
const HOST = process.env.GENT_HOST || '127.0.0.1';
const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const MAX_BODY = 256 * 1024, MAX_OUT = 64 * 1024, MAX_READ = 512 * 1024, MAX_PREVIEW = 2 * 1024 * 1024;
const BOOT = Date.now();
const EDITION = 'Build Vision 1.0';

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

/* ══════════════════════ PROTOCOLE ZÉRO ERREUR (sans exécuter) ══════════════ */
// Étage 1 — Analyse syntaxique : vrai parse AST via le moteur V8 (vm.Script),
// le code n'est PAS exécuté. Pointe ligne + colonne de la première erreur.
function syntaxCheck(code, filename) {
  try { new vm.Script(code, { filename: filename || 'gent.js' }); return { ok: true, engine: 'v8-ast' }; }
  catch (e) {
    if (!(e instanceof SyntaxError)) return { ok: false, line: null, col: null, message: String(e.message || e), engine: 'v8-ast' };
    let line = null, col = null;
    const lines = String(e.stack || '').split('\n');
    const m1 = lines[0] && lines[0].match(/:(\d+)\s*$/);
    if (m1) line = Number(m1[1]);
    const caret = lines.find(l => l.trim().startsWith('^'));
    if (caret) col = caret.indexOf('^') + 1;
    return { ok: false, line, col, message: String(e.message || e), engine: 'v8-ast' };
  }
}
// Étage 2 — Analyse statique stdlib (jamais d'exécution) : règles ciblées.
function lintJS(code) {
  const out = [];
  const lines = String(code).split('\n');
  const hasLookbehind = (() => { try { return new RegExp('(?<=a)b') instanceof RegExp; } catch (e) { return false; } })();
  const looseEq = hasLookbehind ? /(?<![=!<>])(==|!=)(?!=)/ : /[^=!<>](==|!=)[^=]/;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const n = i + 1;
    if (/\bdebugger\b/.test(L)) out.push({ line: n, level: 'error', rule: 'no-debugger', msg: 'instruction debugger interdite (bloque le build)' });
    if (/\beval\s*\(/.test(L)) out.push({ line: n, level: 'error', rule: 'no-eval', msg: 'eval() interdit — faille par excécution dynamique' });
    if (/\bnew\s+Function\s*\(/.test(L)) out.push({ line: n, level: 'warn', rule: 'no-new-func', msg: 'new Function() = eval déguisé' });
    if (looseEq.test(L) && !/^\s*(\/\/|\*)/.test(L)) out.push({ line: n, level: 'warn', rule: 'eqeqeq', msg: 'égalité faible == / != — préférer === / !==' });
    if (/\bvar\s+[A-Za-z_$]/.test(L)) out.push({ line: n, level: 'info', rule: 'no-var', msg: 'var détecté — préférer const / let' });
    if (/\bwith\s*\(/.test(L)) out.push({ line: n, level: 'error', rule: 'no-with', msg: 'with() interdit en mode strict' });
    if (/\bsetTimeout\s*\(\s*["']/.test(L)) out.push({ line: n, level: 'warn', rule: 'no-settimeout-string', msg: 'setTimeout avec une chaîne = injection de code' });
    if (/\b(TODO|FIXME|XXX)\b/.test(L)) out.push({ line: n, level: 'info', rule: 'no-todo', msg: 'marqueur TODO/FIXME restant' });
    if (L.length > 120) out.push({ line: n, level: 'info', rule: 'max-len', msg: 'ligne > 120 caractères' });
  }
  const logs = (code.match(/console\.log\s*\(/g) || []).length;
  if (logs > 8) out.push({ line: 0, level: 'info', rule: 'no-console-spam', msg: logs + ' console.log — pense à nettoyer avant production' });
  return out.slice(0, 60);
}
// Références d'un fichier HTML : vérifie que src/href locaux existent (le site
// "se construit" seulement si ses briques sont présentes).
function htmlRefs(code, baseDir) {
  const out = [];
  const re = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(String(code))) !== null) {
    const ref = m[1];
    if (/^(https?:|\/\/|data:|#|mailto:|about:)/i.test(ref)) continue;
    const f = inside(baseDir, ref.split(/[?#]/)[0]);
    out.push({ ref, ok: f ? fs.existsSync(f) : false });
  }
  return out;
}
// Pipeline complet de validation (aucune exécution).
function validateCode(p, code) {
  const ext = path.extname(String(p || '')).toLowerCase();
  const rep = { file: p, kind: 'js', syntax: null, lint: [], refs: [], checks: 0 };
  if (ext === '.html' || ext === '.htm') {
    rep.kind = 'html';
    rep.syntax = { ok: true, engine: 'html-pass' };
    if (!/<!doctype html>/i.test(code)) rep.lint.push({ line: 1, level: 'warn', rule: 'doctype', msg: 'doctype absent — rendu quirk mode' });
    if (!/<\/html>/i.test(code)) rep.lint.push({ line: 0, level: 'warn', rule: 'html-close', msg: '</html> fermant introuvable' });
    rep.refs = htmlRefs(code, path.dirname(path.join(WORKSPACE, String(p || 'x'))));
    rep.refs.filter(r => !r.ok).forEach(r => rep.lint.push({ line: 0, level: 'error', rule: 'missing-ref', msg: 'référence manquante : ' + r.ref }));
  } else if (ext === '.css') {
    rep.kind = 'css';
    rep.syntax = { ok: true, engine: 'css-pass' };
    const opens = (code.match(/\{/g) || []).length, closes = (code.match(/\}/g) || []).length;
    if (opens !== closes) rep.lint.push({ line: 0, level: 'error', rule: 'css-braces', msg: 'accolades CSS déséquilibrées : ' + opens + ' { vs ' + closes + ' }' });
  } else {
    rep.syntax = syntaxCheck(code, p || 'gent.js');
    rep.lint = lintJS(code);
  }
  if (rep.syntax && !rep.syntax.ok) rep.lint.unshift({ line: rep.syntax.line || 0, level: 'error', rule: 'syntax', msg: rep.syntax.message });
  rep.checks = rep.lint.length;
  rep.blocked = rep.lint.some(l => l.level === 'error');
  return rep;
}

/* ════════════════════════════ SSE (hot reload) ═════════════════════════════ */
// Server-Sent Events : flux HTTP natif stdlib — le canal temps réel du Build
// Vision (équivalent WebSocket sans dépendance, unidirectionnel serveur→IDE).
const SSE = new Set();
function broadcast(event, obj) {
  const payload = 'event: ' + event + '\ndata: ' + JSON.stringify(obj) + '\n\n';
  for (const r of SSE) { try { r.write(payload); } catch (e) { SSE.delete(r); } }
}
setInterval(() => { for (const r of SSE) { try { r.write(': ping\n\n'); } catch (e) { SSE.delete(r); } } }, 15000).unref();

/* ════════════════════════════ Démo seedée au boot ══════════════════════════ */
async function seedDemo() {
  const dir = path.join(WORKSPACE, 'demo-vision');
  try { await fsp.mkdir(dir, { recursive: true }); } catch (e) {}
  const idx = path.join(dir, 'index.html');
  try { await fsp.access(idx); return; } catch (e) {}
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>GENT · Build Vision — Démo</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<h1>GENT BUILD VISION</h1>
<p class="sub">Ce site se construit en direct pendant que tu codes.</p>
<div id="site" class="site"></div>
<p class="foot">Modifie <code>app.js</code> ou <code>style.css</code> puis clique <b>⚡ Build &amp; Run</b>.</p>
<script src="app.js"></script>
</body>
</html>
`;
  const css = `:root{--bg:#0a0a0f;--ink:#eaf7f0;--acc:#00ff9d;--dim:#5b6b64}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}
h1{letter-spacing:.14em;color:var(--acc);text-shadow:0 0 24px rgba(0,255,157,.4)}
.sub{color:var(--dim)}
.site{display:grid;grid-template-columns:repeat(4,64px);gap:10px;margin:18px 0}
.blk{width:64px;height:64px;border-radius:10px;background:#101018;border:1px solid #1e1e28;transition:.5s cubic-bezier(.2,.8,.2,1);opacity:0;transform:translateY(26px) scale(.85)}
.blk.on{opacity:1;transform:none;border-color:var(--acc);box-shadow:0 0 18px rgba(0,255,157,.35)}
.blk.hot{background:var(--acc)}
.foot{color:var(--dim);font-size:13px}
code{color:var(--acc)}
`;
  const js = `// Démo Build Vision — les blocs se posent comme une maison qui s'élève
const site = document.getElementById("site");
const NBLOCKS = 16;
for (let i = 0; i < NBLOCKS; i++) {
  const b = document.createElement("div");
  b.className = "blk";
  site.appendChild(b);
}
const blocks = document.querySelectorAll(".blk");
blocks.forEach((b, i) => {
  setTimeout(() => {
    b.classList.add("on");
    if (i === 5 || i === 10) b.classList.add("hot");
    console.log("bloc " + (i + 1) + "/" + NBLOCKS + " posé");
  }, 220 * i);
});
console.log("GENT Build Vision — démo en ligne sur Node " + process.version);
`;
  try {
    await fsp.writeFile(idx, html, { mode: 0o600 });
    await fsp.writeFile(path.join(dir, 'style.css'), css, { mode: 0o600 });
    await fsp.writeFile(path.join(dir, 'app.js'), js, { mode: 0o600 });
  } catch (e) {}
}

/* ════════════════════════════ PAGE CLASSIQUE ═══════════════════════════════ */
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
.chip,a.chip{border:1px solid var(--line);background:#0e0e15;border-radius:999px;padding:4px 12px;font-size:11px;color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace;text-decoration:none}
a.chip:hover{border-color:var(--acc2);color:var(--acc2)}
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
 <div class="chips"><a class="chip" href="/vision" style="border-color:#00ff9d;color:#00ff9d">⚡ BUILD VISION</a><span class="chip" id="chip-instance">__INSTANCE__</span><span class="chip" id="chip-build">build __BUILD__</span><span class="chip" id="chip-node">Node __NODEVER__ · PFE</span></div>
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

/* ═════════════════════════ PAGE BUILD VISION (3 panneaux) ══════════════════ */
const VISION = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GENT · Build Vision — Live Build</title>
<style>
:root{--bg:#0a0a0f;--panel:#0d0d14;--line:#1c1c26;--txt:#e8f5ee;--dim:#6b7a72;--acc:#00ff9d;--cyan:#00d4ff;--red:#ff2d55;--amber:#ffc857}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:var(--bg);color:var(--txt);font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;overflow:hidden}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#0e0e16,#0a0a10);flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px}
.dot{width:9px;height:9px;border-radius:50%;background:var(--acc);box-shadow:0 0 12px var(--acc);animation:pulse 2s infinite}
@keyframes pulse{50%{opacity:.35}}
.name{font-weight:800;letter-spacing:.18em;font-size:14px;color:var(--acc);text-shadow:0 0 18px rgba(0,255,157,.45)}
.tag{color:var(--dim);font-size:10.5px;letter-spacing:.16em}
#status{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:5px 14px;font:600 12px ui-monospace,monospace;background:#0b0b12;min-width:190px;justify-content:center}
#status .led{width:9px;height:9px;border-radius:50%;background:var(--dim)}
#status.ready .led{background:var(--dim);box-shadow:none}
#status.busy .led{background:var(--cyan);box-shadow:0 0 10px var(--cyan);animation:pulse .7s infinite}
#status.ok .led{background:var(--acc);box-shadow:0 0 10px var(--acc)}
#status.err .led{background:var(--red);box-shadow:0 0 10px var(--red)}
.chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.chip,a.chip{border:1px solid var(--line);background:#0e0e15;border-radius:999px;padding:3px 10px;font-size:10.5px;color:var(--dim);font-family:ui-monospace,monospace;text-decoration:none}
a.chip:hover{border-color:var(--acc);color:var(--acc)}
#bar{display:flex;gap:8px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line);background:#0b0b11;flex-wrap:wrap}
#bar input{background:#07070b;border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:7px 10px;font:12px ui-monospace,monospace;width:230px}
#bar input:focus{outline:1px solid var(--acc)}
button{cursor:pointer;border:1px solid var(--line);background:#101018;color:var(--txt);border-radius:9px;padding:7px 13px;font-size:12px;font-weight:700;transition:.15s}
button:hover{border-color:var(--acc);box-shadow:0 0 14px rgba(0,255,157,.22)}
button#btn-build{background:linear-gradient(90deg,#00c46f,#00ff9d);color:#04150c;border:none;letter-spacing:.04em}
button#btn-build:disabled{opacity:.55;cursor:wait}
label.tgl{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dim);user-select:none;cursor:pointer}
main{flex:1;display:grid;grid-template-columns:200px minmax(280px,1fr) minmax(240px,320px) minmax(300px,430px);min-height:0}
.pane{border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0;min-height:0}
.pane:last-child{border-right:none}
.pane h3{font-size:10px;letter-spacing:.2em;color:var(--dim);text-transform:uppercase;padding:8px 12px;border-bottom:1px solid var(--line);background:#0c0c12;display:flex;justify-content:space-between;align-items:center;gap:6px}
.pane h3 .mini{font-size:9.5px;letter-spacing:.05em;color:var(--dim);cursor:pointer;border:1px solid var(--line);border-radius:6px;padding:2px 7px}
.pane h3 .mini:hover{color:var(--acc);border-color:var(--acc)}
#tree{overflow:auto;padding:6px;flex:1}
.f{padding:5px 8px;border-radius:7px;cursor:pointer;font:11.5px ui-monospace,monospace;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.f:hover{background:#12121b}
.f.active{background:#0d1f17;color:var(--acc);box-shadow:inset 2px 0 0 var(--acc)}
.f i{color:var(--dim);font-style:normal;margin-left:6px;font-size:10px}
.ed-wrap{flex:1;display:flex;min-height:0;background:#07070b}
#gutter{width:44px;padding:12px 8px 12px 0;text-align:right;font:12.5px/1.55 ui-monospace,Menlo,Consolas,monospace;color:#3d4a44;background:#08080d;border-right:1px solid var(--line);overflow:hidden;user-select:none;white-space:pre}
#gutter b{display:block}
#gutter b.err{color:var(--red);background:rgba(255,45,85,.14);border-radius:4px;margin-right:2px}
#editor{flex:1;border:none;outline:none;resize:none;background:transparent;color:#d9ffe9;padding:12px;font:12.5px/1.55 ui-monospace,Menlo,Consolas,monospace;white-space:pre;overflow:auto;tab-size:2}
#term{flex:1;overflow:auto;padding:10px 12px;font:11.5px/1.65 ui-monospace,Menlo,Consolas,monospace;background:#060609;white-space:pre-wrap;word-break:break-word}
.tl{margin:0 0 3px}
.t-info{color:#8fa8ff}.t-ok{color:var(--acc)}.t-err{color:var(--red)}.t-warn{color:var(--amber)}.t-dim{color:#4d5a54}.t-head{color:var(--cyan);font-weight:700}
.pv-bar{display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--line);background:#0b0b11}
#pv-select{background:#07070b;border:1px solid var(--line);color:var(--txt);border-radius:7px;padding:5px 8px;font:11.5px ui-monospace,monospace;flex:1;min-width:0}
#preview{flex:1;border:none;background:#fff;width:100%;min-height:0}
footer{border-top:1px solid var(--line);padding:6px 16px;color:var(--dim);font-size:10.5px;display:flex;justify-content:space-between;gap:10px;font-family:ui-monospace,monospace;flex-wrap:wrap}
@media(max-width:1100px){main{grid-template-columns:160px 1fr 260px;grid-auto-rows:minmax(200px,42vh)} .pane.pv{grid-column:1/-1;border-top:1px solid var(--line)}}
</style>
</head>
<body>
<header>
 <div class="brand"><span class="dot"></span><span class="name">GENT · BUILD VISION</span><span class="tag">LE SITE SE CONSTRUIT SOUS TES YEUX</span></div>
 <div id="status" class="ready"><span class="led"></span><span id="status-txt">● Système prêt</span></div>
 <div class="chips"><a class="chip" href="/">◧ IDE classique</a><span class="chip">__INSTANCE__</span><span class="chip">Node __NODEVER__</span></div>
</header>
<div id="bar">
 <input id="file" placeholder="demo-vision/index.html" spellcheck="false">
 <button id="btn-new">+ Nouveau</button>
 <button id="btn-save">Enregistrer</button>
 <button id="btn-build">⚡ BUILD &amp; RUN</button>
 <label class="tgl"><input type="checkbox" id="auto" checked style="accent-color:#00ff9d"> auto-validation</label>
</div>
<main>
 <section class="pane"><h3>Workspace <span class="mini" id="btn-tree">↻</span></h3><div id="tree"></div></section>
 <section class="pane"><h3>Éditeur · <span id="ed-file">—</span></h3>
   <div class="ed-wrap"><div id="gutter"></div><textarea id="editor" spellcheck="false"></textarea></div>
 </section>
 <section class="pane"><h3>Terminal de build</h3><div id="term"><span class="t-dim">Prêt. Ctrl+S = enregistrer + builder · Ctrl+Entrée = builder.</span></div></section>
 <section class="pane pv"><h3>Live Preview <span class="mini" id="btn-reload">⟳ recharger</span></h3>
   <div class="pv-bar"><select id="pv-select"></select><button id="btn-tab">↗</button></div>
   <iframe id="preview" title="aperçu live"></iframe>
 </section>
</main>
<footer><span>__HOSTPORT__ · jeton d'instance · SSE hot reload · sandbox Node 22</span><span id="uptime"></span></footer>
<script>
"use strict";
var T = "__TOKEN__";
var $ = function(id){ return document.getElementById(id); };
var cur = "", building = false, errLines = [];
function status(kind, txt){ var s=$("status"); s.className=kind; $("status-txt").textContent=txt; }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function fmt(b){ if(b>1048576) return (b/1048576).toFixed(1)+" Mo"; if(b>1024) return (b/1024).toFixed(1)+" Ko"; return b+" o"; }
function api(m,p,b){ return fetch(p,{method:m,headers:{"X-Gent-Token":T,"Content-Type":"application/json"},body:b?JSON.stringify(b):undefined}).then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }).catch(function(){ return {ok:r.ok,j:{}}; }); }); }
function ts(){ var d=new Date(); return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)+":"+("0"+d.getSeconds()).slice(-2); }
function log(txt, cls){ var t=$("term"); var e=document.createElement("div"); e.className="tl t-"+(cls||"dim"); e.textContent="["+ts()+"] "+txt; t.appendChild(e); t.scrollTop=t.scrollHeight; }
function logHead(txt){ var t=$("term"); var e=document.createElement("div"); e.className="tl t-head"; e.textContent="── "+txt+" ──────────────────────"; t.appendChild(e); t.scrollTop=t.scrollHeight; }

/* ——— éditeur : gutter numéroté + marqueurs d'erreur ——— */
var ed = $("editor");
function renderGutter(){
  var n = ed.value.split("\\n").length;
  var h = "";
  for (var i=1;i<=n;i++){ h += "<b"+(errLines.indexOf(i)>=0?' class="err"':"")+">"+i+"</b>"; }
  $("gutter").innerHTML = h;
  $("gutter").scrollTop = ed.scrollTop;
}
ed.addEventListener("scroll", function(){ $("gutter").scrollTop = ed.scrollTop; });
ed.addEventListener("keydown", function(e){
  if (e.key === "Tab"){ e.preventDefault();
    var s=ed.selectionStart, epos=ed.selectionEnd;
    ed.value = ed.value.slice(0,s) + "  " + ed.value.slice(epos);
    ed.selectionStart = ed.selectionEnd = s+2;
  }
  if ((e.ctrlKey||e.metaKey) && e.key === "s"){ e.preventDefault(); save(true); }
  if ((e.ctrlKey||e.metaKey) && e.key === "Enter"){ e.preventDefault(); build(); }
});
var vTimer = null;
ed.addEventListener("input", function(){
  renderGutter();
  if (!$("auto").checked || building) return;
  clearTimeout(vTimer);
  status("busy","⚡ Analyse…");
  vTimer = setTimeout(function(){ validate(false); }, 900);
});

/* ——— workspace ——— */
function tree(d){ api("GET","/api/files?p="+encodeURIComponent(d||"")).then(function(x){
  if(!x.ok){ log("workspace illisible : "+(x.j.error||"?"),"err"); return; }
  var j=x.j, h=j.entries.map(function(e){
    return '<div class="f" data-p="'+e.p+'" data-t="'+e.type+'">'+(e.type==="d"?"▸ ":"· ")+e.name+(e.type==="f"?"<i>"+fmt(e.size)+"</i>":"")+'</div>';
  }).join("");
  $("tree").innerHTML = h || '<div class="f" style="color:#4d5a54">(vide)</div>';
  var els=document.querySelectorAll("#tree .f");
  for (var i=0;i<els.length;i++){ els[i].onclick=function(){
    var p=this.getAttribute("data-p");
    if (this.getAttribute("data-t")==="d"){ tree(p); return; }
    $("file").value=p; load();
  };}
  pvList();
}); }
function pvList(){ // cibles preview = tous les .html du workspace (racine + 1 niveau)
  api("GET","/api/files").then(function(a){ if(!a.ok) return;
    var roots=a.j.entries.filter(function(e){return e.type==="f" && /\.html?$/i.test(e.name);}).map(function(e){return e.p;});
    var dirs=a.j.entries.filter(function(e){return e.type==="d";});
    var chain = Promise.resolve(roots);
    dirs.forEach(function(d){
      chain = chain.then(function(acc){
        return api("GET","/api/files?p="+encodeURIComponent(d.p)).then(function(b){
          if(b.ok) b.j.entries.forEach(function(e){ if(e.type==="f" && /\\.html?$/i.test(e.name)) acc.push(e.p); });
          return acc;
        });
      });
    });
    chain.then(function(acc){
      var seen={}, list=[];
      acc.forEach(function(p){ if(!seen[p]){ seen[p]=1; list.push(p); } });
      if (!list.length) list.push("demo-vision/index.html");
      $("pv-select").innerHTML = list.map(function(p){ return '<option value="'+p+'">'+p+'</option>'; }).join("");
      pvGo();
    });
  });
}
function load(){ var p=$("file").value; if(!p) return;
  api("GET","/api/read?p="+encodeURIComponent(p)).then(function(x){
    if(x.ok){ cur=p; ed.value=x.j.content; $("ed-file").textContent=p; errLines=[]; renderGutter(); pvList(); status("ready","● Prêt · "+fmt(x.j.bytes)); log("chargé : "+p,"info"); }
    else log("erreur : "+(x.j.error||"?"),"err");
  });
}
function save(thenBuild){
  var p=$("file").value;
  if(!p){ log("indique un chemin (ex : demo-vision/index.html)","warn"); return Promise.resolve(false); }
  return api("POST","/api/write",{p:p,content:ed.value}).then(function(x){
    if(!x.ok){ log("écriture refusée : "+(x.j.error||"?"),"err"); return false; }
    cur=p; $("ed-file").textContent=p;
    log("enregistré : "+p+" · sha256 "+String(x.j.sha256).slice(0,20)+"…","ok");
    tree(); return thenBuild ? build() : validate(true);
  });
}
function del(){ var p=$("file").value; if(!p) return;
  api("POST","/api/delete",{p:p}).then(function(x){ if(x.ok){ log("supprimé : "+p,"warn"); cur=""; ed.value=""; $("file").value=""; $("ed-file").textContent="—"; tree(); } });
}

/* ——— protocole ZÉRO ERREUR : valider sans exécuter ——— */
function validate(loud){
  var p=$("file").value || cur || "buffer.js";
  return api("POST","/api/validate",{p:p,code:ed.value}).then(function(x){
    if(!x.ok){ log("validation impossible : "+(x.j.error||"?"),"err"); return null; }
    var j=x.j;
    errLines=[];
    if (j.lint) j.lint.forEach(function(l){ if(l.line) errLines.push(l.line); });
    renderGutter();
    if (!j.blocked){
      if (loud) log("validation : 0 erreur bloquante · "+j.checks+" remarque(s)","ok");
      status("ok","✅ Analyse propre"+(j.checks?" · "+j.checks+" note(s)":""));
    } else {
      var first=j.lint.filter(function(l){return l.level==="error";})[0];
      log("ERREUR ligne "+(first.line||"?")+" : "+first.msg,"err");
      status("err","❌ Erreur · ligne "+(first.line||"?"));
    }
    return j;
  });
}

/* ——— BUILD & RUN : valider → compiler → exécuter (sandbox) → publier ——— */
function build(){
  if (building) return;
  var p=$("file").value;
  if(!p){ log("indique un chemin avant de builder","warn"); return; }
  building = true; $("btn-build").disabled = true;
  status("busy","⚡ Compilation…"); logHead("BUILD & RUN");
  api("POST","/api/build",{p:p,content:ed.value}).then(function(x){
    building = false; $("btn-build").disabled = false;
    if(!x.ok){ log("build refusé : "+(x.j.error||"?"),"err"); status("err","❌ Erreur"); return; }
    var j=x.j, bad=false;
    // SYNTAXE
    logHead("1 · SYNTAXE (AST V8, sans exécuter)");
    if (j.syntax && j.syntax.ok) log("syntaxe valide ("+j.syntax.engine+")","ok");
    else { bad=true; log("ligne "+(j.syntax.line||"?")+", colonne "+(j.syntax.col||"?")+" : "+j.syntax.message,"err"); }
    // LINT
    logHead("2 · ANALYSE STATIQUE ("+j.lint.length+" remarques)");
    j.lint.forEach(function(l){
      log("L"+(l.line||"—")+" ["+l.level.toUpperCase()+"] "+l.rule+" — "+l.msg, l.level==="error"?"err":(l.level==="warn"?"warn":"info"));
      if (l.level==="error") bad=true;
    });
    if (!j.lint.length) log("aucune remarque","ok");
    // COMPIL
    if (j.compile){
      logHead("3 · COMPILATION sèche (node --check)");
      if (j.compile.ok) log("byte-compile OK","ok");
      else { bad=true; log(String(j.compile.output||"échec"),"err"); }
    }
    // EXÉCUTION
    if (j.exec && !j.exec.skipped){
      logHead("4 · EXÉCUTION sandbox (permission model)");
      if (j.exec.stdout) log(j.exec.stdout.trim(),"dim");
      if (j.exec.stderr) log(j.exec.stderr.trim(),"err");
      log("exit "+j.exec.code+" · "+j.exec.ms+" ms"+(j.exec.sandbox?" · sandbox":" · direct"), j.exec.code===0?"ok":"err");
      if (j.exec.code!==0) bad=true;
    } else if (j.exec && j.exec.skipped){
      logHead("4 · EXÉCUTION");
      log("non applicable ("+j.exec.skipped+") — publication directe","info");
    }
    // PUBLICATION
    logHead("5 · PUBLICATION");
    log("en ligne : /preview/"+j.published,"ok");
    var sel=$("pv-select");
    var found=false;
    for (var i=0;i<sel.options.length;i++){ if(sel.options[i].value===j.published){ found=true; break; } }
    if (!found){ sel.insertAdjacentHTML("afterbegin",'<option value="'+j.published+'">'+j.published+'</option>'); }
    sel.value=j.published;
    if (bad){ status("err","❌ Erreur — voir terminal"); log("BUILD ÉCHOUÉ · "+j.ms+" ms","err"); }
    else { status("ok","✅ Succès · "+j.ms+" ms"); log("BUILD RÉUSSI · "+j.ms+" ms · site rechargé","ok"); }
    pvGo();
    tree();
  });
}

/* ——— live preview + SSE hot reload ——— */
function pvGo(){
  var p=$("pv-select").value;
  if(!p) return;
  $("preview").src = "/preview/"+p+"?t="+encodeURIComponent(T)+"&r="+Date.now();
}
$("btn-reload").onclick = pvGo;
$("btn-tab").onclick = function(){ window.open("/preview/"+$("pv-select").value+"?t="+encodeURIComponent(T),"_blank"); };
$("pv-select").onchange = pvGo;
if (window.EventSource){
  var es = new EventSource("/api/events?t="+encodeURIComponent(T));
  es.addEventListener("reload", function(ev){
    try { var d = JSON.parse(ev.data);
      log("hot reload : "+d.p,"info");
      pvGo();
    } catch(e){}
  });
  es.addEventListener("build", function(ev){
    try { var d = JSON.parse(ev.data);
      if (d.ok) status("ok","✅ Succès · "+d.ms+" ms"); else status("err","❌ Erreur");
    } catch(e){}
  });
  es.onerror = function(){ status("ready","● reconnexion…"); };
}

$("btn-save").onclick=function(){ save(false); };
$("btn-build").onclick=build;
$("file").addEventListener("keydown",function(e){ if(e.key==="Enter") load(); });
$("btn-tree").onclick=function(){ tree(); };
$("btn-new").onclick=function(){
  var p=prompt("Nouveau fichier (chemin relatif) :","");
  if(!p) return;
  $("file").value=p;
  api("POST","/api/write",{p:p,content:("<!-- "+p+" -->\\n")}).then(function(x){
    if(x.ok){ log("créé : "+p,"ok"); tree(); load(); }
  });
};
tree();
if (!$("file").value){ $("file").value="demo-vision/index.html"; load(); }
setInterval(function(){ fetch("/api/health").then(function(r){return r.json();}).then(function(j){ $("uptime").textContent="uptime "+(j.uptime_s|0)+" s · "+j.instance_id; }); }, 1000);
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
function visionPage() {
  return VISION
    .replace('__INSTANCE__', ID.instance_id)
    .replace('__NODEVER__', process.version)
    .replace('__TOKEN__', TOKEN)
    .replace('__HOSTPORT__', HOST + ':' + PORT);
}

const PREVIEW_TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.map': 'application/json; charset=utf-8'
};

/* ——— exécution sandbox commune (permission model Node ≥20) ——— */
function execSandbox(file, res, cb) {
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
    cb(null, { code: c, stdout: so.slice(0, MAX_OUT), stderr: se.slice(0, MAX_OUT), ms: Date.now() - t0, sandbox: sandboxed });
  });
}
/* ——— compilation sèche (node --check) : valide sans exécuter ——— */
function dryCompile(file, cb) {
  const child = spawn(process.execPath, ['--check', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  let se = '', done = false;
  const timer = setTimeout(() => { if (!done) { try { child.kill('SIGKILL'); } catch (e) {} } }, 4000);
  child.stderr.on('data', d => { if (se.length < 8192) se += d.toString('utf8'); });
  child.on('error', e => { se += String(e.message || e); });
  child.on('close', c => {
    if (done) return; done = true; clearTimeout(timer);
    cb(null, { ok: c === 0, output: c === 0 ? '' : se.slice(0, 4096) });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    const p = u.pathname;

    /* ——— pages ——— */
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(page());
    }
    if (req.method === 'GET' && p === '/vision') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(visionPage());
    }
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }

    if (p === '/api/health') {
      return json(res, 200, { status: 'ok', uptime_s: Math.floor((Date.now() - BOOT) / 1000), version: process.version, instance_id: ID.instance_id, edition: EDITION });
    }

    /* ——— SSE hot reload : jeton via ?t= (EventSource ne peut pas poser d'en-tête) ——— */
    if (p === '/api/events') {
      if (!TOKEN || (u.searchParams.get('t') || req.headers['x-gent-token']) !== TOKEN) {
        return json(res, 401, { error: "jeton requis (?t= ou X-Gent-Token)" });
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write('retry: 2000\n\n');
      SSE.add(res);
      req.on('close', () => SSE.delete(res));
      return;
    }

    /* ——— live preview : fichiers du workspace servis au navigateur ———
       Auth : ?t= (document top) PUIS cookie gent_pv déposé par ce document —
       les sous-ressources relatives (style.css, app.js) passent sans jeton. */
    if (req.method === 'GET' && p.startsWith('/preview/')) {
      const ck = String(req.headers.cookie || '').split(/;\s*/);
      const cTok = ck.reduce((a, c) => { const i = c.indexOf('='); return (i > 0 && c.slice(0, i) === 'gent_pv') ? c.slice(i + 1) : a; }, '');
      const tok = u.searchParams.get('t') || req.headers['x-gent-token'] || cTok;
      if (!TOKEN || tok !== TOKEN) {
        return json(res, 401, { error: 'jeton requis (?t= ou cookie gent_pv)' });
      }
      const rel = decodeURIComponent(p.slice('/preview/'.length));
      if (rel.includes('/.') || rel.split('/').some(s => s.startsWith('.'))) return json(res, 400, { error: 'fichiers cachés interdits' });
      let f = inside(WORKSPACE, rel);
      if (!f) return json(res, 400, { error: 'chemin refusé (sortie du workspace)' });
      let st = await fsp.stat(f).catch(() => null);
      if (st && st.isDirectory()) { f = path.join(f, 'index.html'); st = await fsp.stat(f).catch(() => null); }
      if (!st) return json(res, 404, { error: 'introuvable : ' + rel });
      if (st.size > MAX_PREVIEW) return json(res, 413, { error: 'fichier > 2 Mo' });
      const ext = path.extname(f).toLowerCase();
      const ct = PREVIEW_TYPES[ext];
      if (!ct) return json(res, 415, { error: 'type non servi en preview : ' + ext });
      const buf = await fsp.readFile(f);
      res.writeHead(200, {
        'Content-Type': ct, 'Cache-Control': 'no-store', 'X-Gent-Preview': '1',
        'Set-Cookie': 'gent_pv=' + TOKEN + '; Path=/preview; SameSite=Strict; HttpOnly'
      });
      return res.end(buf);
    }

    // ——— au-delà de ce point : jeton d'instance obligatoire (en-tête) ———
    if (!TOKEN || req.headers['x-gent-token'] !== TOKEN) {
      return json(res, 401, { error: "jeton d'instance requis (en-tête X-Gent-Token)" });
    }

    if (p === '/api/info') {
      let n = 0;
      try { n = (await fsp.readdir(WORKSPACE)).length; } catch (e) {}
      return json(res, 200, {
        node: { version: process.version, edition: 'Premium Founder Edition', exec: process.execPath },
        vision: EDITION,
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

    /* ——— VALIDATION sans exécution (protocole zéro erreur, étages 1+2) ——— */
    if (p === '/api/validate' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const code = String(b.code == null ? '' : b.code);
      const rep = validateCode(String(b.p || 'buffer.js'), code);
      return json(res, 200, { ok: true, file: rep.file, kind: rep.kind, syntax: rep.syntax, lint: rep.lint, refs: rep.refs, checks: rep.checks, blocked: rep.blocked });
    }

    /* ——— BUILD & RUN : valider → compiler → exécuter → publier → hot reload ——— */
    if (p === '/api/build' && req.method === 'POST') {
      const t0 = Date.now();
      const b = JSON.parse(await readBody(req));
      const rel = String(b.p || '');
      const f = inside(WORKSPACE, rel);
      if (!f || !rel) return json(res, 400, { error: 'chemin refusé (sortie du workspace)' });
      const content = b.content == null ? null : String(b.content);
      if (content != null) {
        await fsp.mkdir(path.dirname(f), { recursive: true });
        await fsp.writeFile(f, content, { encoding: 'utf8', mode: 0o600 });
      }
      let code;
      try { code = content != null ? content : (await fsp.readFile(f, 'utf8')); }
      catch (e) { return json(res, 404, { error: 'fichier introuvable : ' + rel }); }

      const ext = path.extname(rel).toLowerCase();
      const rep = validateCode(rel, code);
      const out = { ok: !rep.blocked, blocked: rep.blocked, p: rel, published: rel, syntax: rep.syntax, lint: rep.lint, refs: rep.refs, compile: null, exec: null, ms: 0 };

      if (!rep.blocked && (ext === '.js' || ext === '.mjs')) {
        const dc = await new Promise(r => dryCompile(f, (e, v) => r(v)));
        out.compile = dc;
        if (dc.ok) {
          out.exec = await new Promise(r => execSandbox(f, res, (e, v) => r(v)));
        }
      } else if (!rep.blocked && (ext === '.html' || ext === '.htm' || ext === '.css')) {
        out.exec = { skipped: ext, reason: 'publication directe (fichier web)' };
      }
      out.ok = !(rep.blocked || (out.compile && !out.compile.ok) || (out.exec && typeof out.exec.code === 'number' && out.exec.code !== 0));
      out.ms = Date.now() - t0;
      broadcast('reload', { p: rel });
      broadcast('build', { ok: out.ok, ms: out.ms });
      return json(res, 200, out);
    }

    if (p === '/api/run' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const code = String(b.code || '');
      if (!code.trim()) return json(res, 400, { error: 'code vide' });
      await fsp.mkdir(RUNS_DIR, { recursive: true });
      const rid = crypto.randomBytes(6).toString('hex');
      const file = path.join(RUNS_DIR, 'run-' + rid + '.js');
      await fsp.writeFile(file, code, { mode: 0o600 });
      return execSandbox(file, res, (e, v) => {
        fsp.rm(file, { force: true }).catch(() => {});
        return json(res, 200, v);
      });
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

seedDemo().finally(() => {
  server.listen(PORT, HOST, () => {
    console.log('[gent] ' + EDITION + ' en ligne — http://' + HOST + ':' + PORT + ' · instance ' + ID.instance_id + ' · node ' + process.version);
    console.log('[gent] IDE classique : / · Build Vision : /vision');
  });
});
server.on('error', e => { console.error('[gent] ERREUR : ' + e.message); process.exit(2); });
