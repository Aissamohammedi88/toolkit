#!/usr/bin/env bash
# =============================================================================
#  GENT — Node 22 Premium Founder Edition (PFE)
#  Installeur autonome · sans nano · sans interaction.
#
#  Ce que ce script fait, dans l'ordre :
#    1. Garde-fou : la zone sacrée ~/Aether n'est JAMAIS lue ni écrite.
#    2. Préfixe isolé ~/gent (sandbox : runtime + app + identité + workspace).
#    3. Clone les binaires officiels Node 22 LTS (nodejs.org) + SHA256 strict.
#    4. Transformation PFE : wrappers durcis, compile-cache V8 persistant,
#       modèle de permission Node 22, lancement systemd sandboxé.
#    5. Identité unique d'instance (ID + jeton + machine-id + registre builds).
#    6. IDE local souverain (stdlib only) sur le port dédié 4310.
#    7. Service systemd --user (autostart) + raccourcis bureau + CLI `gent`.
#    8. Scaffold dépôt Git prêt à pousser vers l'organisation GitHub.
#
#  Usage :
#    bash gent-install.sh                  # installation complète (port 4310)
#    bash gent-install.sh --port 4310      # port dédié
#    bash gent-install.sh --version v22.23.4
#    bash gent-install.sh --home /chemin/isole
#    bash gent-install.sh --no-service     # sans unité systemd
#    bash gent-install.sh --selftest       # tests hors-ligne (aucun réseau,
#                                          #   aucun fichier hors $GENT_HOME)
# =============================================================================
set -Eeuo pipefail
umask 077

# ---------------------------------------------------------------- helpers ---
log()  { printf '\033[1;35m[gent]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  ⚠\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[gent:ERREUR]\033[0m %s\n' "$*" >&2; exit 1; }

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo .)"
SELF_PATH="${BASH_SOURCE[0]:-$0}"

# ------------------------------------------------------------- parse args ---
GENT_PORT="4310"; GENT_NODE_VERSION=""; GENT_HOME="${GENT_HOME:-$HOME/gent}"
SELFTEST=0; WITH_SERVICE=1
while [ $# -gt 0 ]; do
  case "$1" in
    --port)      [ $# -ge 2 ] || die "--port exige une valeur";      GENT_PORT="$2"; shift 2 ;;
    --version)   [ $# -ge 2 ] || die "--version exige une valeur";   GENT_NODE_VERSION="$2"; shift 2 ;;
    --home)      [ $# -ge 2 ] || die "--home exige une valeur";      GENT_HOME="$2"; shift 2 ;;
    --no-service) WITH_SERVICE=0; shift ;;
    --selftest)  SELFTEST=1; shift ;;
    *) die "option inconnue : $1" ;;
  esac
done
case "$GENT_PORT" in ''|*[!0-9]*) die "port invalide : $GENT_PORT" ;; esac
[ "$GENT_PORT" -ge 1024 ] && [ "$GENT_PORT" -le 65535 ] || die "port hors plage 1024-65535 : $GENT_PORT"

# ------------------------------------------------- isolation / zone sacrée ---
mkdir -p "$GENT_HOME"
GENT_HOME="$(cd "$GENT_HOME" && pwd)"
AETHER_ZONE="$HOME/Aether"
if [ -e "$AETHER_ZONE" ]; then
  case "$GENT_HOME/" in
    "$AETHER_ZONE"/*|"$AETHER_ZONE") die "GENT_HOME ($GENT_HOME) empiète sur la zone sacrée ~/Aether — refusé." ;;
  esac
fi
case "$GENT_HOME" in /|/usr|/etc|/var|/bin|/sbin|"$HOME") die "GENT_HOME dangereux : $GENT_HOME" ;; esac

cat <<'BAN'

   ██████╗  ███████╗ ███╗   ██╗ ████████╗
  ██╔════╝  ██╔════╝ ████╗  ██║ ╚══██╔══╝
  ██║  ███╗ █████╗   ██╔██╗ ██║    ██║
  ██║   ██║ ██╔══╝   ██║╚██╗██║    ██║
  ╚██████╔╝ ███████╗ ██║ ╚████║    ██║
   ╚═════╝  ╚══════╝ ╚═╝  ╚═══╝    ╚═╝
   NODE 22 · PREMIUM FOUNDER EDITION

BAN
log "Préfixe isolé        : $GENT_HOME"
log "Port dédié           : $GENT_PORT"
[ "$SELFTEST" = 1 ] && log "Mode                 : SELFTEST (hors-ligne, aucun fichier hors GENT_HOME)"
log "Zone sacrée ~/Aether : INTACTE (aucune lecture, aucune écriture)"

# ---------------------------------------------------------------- dépendances ---
for d in curl tar sha256sum awk sed od grep; do
  command -v "$d" >/dev/null 2>&1 || die "outil manquant : $d  (installe-le, ex. : sudo apt install $d)"
done

# ------------------------------------------------------------ arborescence ---
for sub in runtime app bin share workspace identity logs cache/v8 dist scripts repo; do
  mkdir -p "$GENT_HOME/$sub"
done
chmod 700 "$GENT_HOME" "$GENT_HOME/identity"

# --------------------------------------- 1. runtime : cloner Node 22 LTS ---
install_runtime() {
  case "$(uname -m)" in
    x86_64)          GARCH="x64" ;;
    aarch64|arm64)   GARCH="arm64" ;;
    armv7l)          GARCH="armv7l" ;;
    *) die "architecture non supportée : $(uname -m)" ;;
  esac

  if [ -z "$GENT_NODE_VERSION" ]; then
    log "Résolution de la dernière version Node 22 LTS (nodejs.org)…"
    GENT_NODE_VERSION="$(curl -fsSL --max-time 20 https://nodejs.org/dist/index.json 2>/dev/null \
      | grep -o '"version":"v22\.[0-9]*\.[0-9]*"' | head -n1 | cut -d'"' -f4 || true)"
    if [ -z "$GENT_NODE_VERSION" ]; then
      GENT_NODE_VERSION="v22.14.0"
      warn "détection réseau impossible — repli sur version connue $GENT_NODE_VERSION"
    fi
  fi
  case "$GENT_NODE_VERSION" in v22.[0-9]*.[0-9]*) ;; *) die "version refusée (v22.x.y attendu) : $GENT_NODE_VERSION" ;; esac

  NODE_DIR="node-${GENT_NODE_VERSION}-linux-${GARCH}"
  TARBALL="${NODE_DIR}.tar.gz"
  BASE="https://nodejs.org/dist/${GENT_NODE_VERSION}"
  CACHE="$GENT_HOME/cache/dist"
  mkdir -p "$CACHE"

  if [ ! -x "$GENT_HOME/runtime/current/bin/node" ] || [ "$(readlink -f "$GENT_HOME/runtime/current")" != "$GENT_HOME/runtime/$NODE_DIR" ]; then
    log "Clonage des binaires officiels : $TARBALL"
    [ -f "$CACHE/$TARBALL" ] || curl -fL --retry 3 --max-time 600 -o "$CACHE/$TARBALL" "$BASE/$TARBALL" \
      || die "téléchargement impossible : $BASE/$TARBALL"
    [ -f "$CACHE/SHASUMS256.txt" ] || curl -fsSL --retry 3 --max-time 60 -o "$CACHE/SHASUMS256.txt" "$BASE/SHASUMS256.txt" \
      || die "récupération SHASUMS256.txt impossible"
    WANT="$(awk -v f="$TARBALL" '$2==f{print $1}' "$CACHE/SHASUMS256.txt")"
    [ -n "$WANT" ] || die "checksum introuvable dans SHASUMS256.txt pour $TARBALL"
    GOT="$(sha256sum "$CACHE/$TARBALL" | awk '{print $1}')"
    [ "$GOT" = "$WANT" ] || die "SHA256 MISMATCH — binaire corrompu ou intercepté. Installation stoppée."
    ok "Intégrité SHA256 vérifiée : ${GOT:0:16}…"
    log "Extraction dans le préfixe isolé…"
    tar -xzf "$CACHE/$TARBALL" -C "$GENT_HOME/runtime"
    ln -sfn "$GENT_HOME/runtime/$NODE_DIR" "$GENT_HOME/runtime/current"
  else
    log "Runtime déjà cloné et à jour : $(basename "$(readlink -f "$GENT_HOME/runtime/current")" 2>/dev/null || echo current)"
  fi
  "$GENT_HOME/runtime/current/bin/node" --version >/dev/null 2>&1 || die "runtime Node 22 inopérant après extraction"
  ok "Runtime cloné : $( "$GENT_HOME/runtime/current/bin/node" --version ) — transformé en PFE (wrappers + compile-cache + permission model)"
}

# ------------------------------------------------- 2. transformation PFE ---
write_wrappers() {
  cat > "$GENT_HOME/bin/gent-node" <<'GENT_NODE_EOF'
#!/usr/bin/env bash
# GENT — wrapper Node 22 PFE : compile-cache V8 persistant + tuning semi-space
set -euo pipefail
GH="${GENT_HOME:-$HOME/gent}"
export NODE_COMPILE_CACHE="${NODE_COMPILE_CACHE:-$GH/cache/v8}"
mkdir -p "$NODE_COMPILE_CACHE" 2>/dev/null || true
exec "$GH/runtime/current/bin/node" --max-semi-space-size=64 "$@"
GENT_NODE_EOF

  cat > "$GENT_HOME/bin/gent-npm" <<'GENT_NPM_EOF'
#!/usr/bin/env bash
set -euo pipefail
GH="${GENT_HOME:-$HOME/gent}"
export NODE_COMPILE_CACHE="${NODE_COMPILE_CACHE:-$GH/cache/v8}"
mkdir -p "$NODE_COMPILE_CACHE" 2>/dev/null || true
exec "$GH/runtime/current/bin/npm" "$@"
GENT_NPM_EOF

  cat > "$GENT_HOME/bin/gent-npx" <<'GENT_NPX_EOF'
#!/usr/bin/env bash
set -euo pipefail
GH="${GENT_HOME:-$HOME/gent}"
export NODE_COMPILE_CACHE="${NODE_COMPILE_CACHE:-$GH/cache/v8}"
mkdir -p "$NODE_COMPILE_CACHE" 2>/dev/null || true
exec "$GH/runtime/current/bin/npx" "$@"
GENT_NPX_EOF

  cat > "$GENT_HOME/bin/gent" <<'GENT_CLI_EOF'
#!/usr/bin/env bash
# GENT CLI — Premium Founder Edition
set -euo pipefail
GH="${GENT_HOME:-$HOME/gent}"
PORT="${GENT_PORT:-4310}"
NODE_BIN="$GH/runtime/current/bin/node"
[ -x "$NODE_BIN" ] || NODE_BIN="$(command -v node || true)"
case "${1:-help}" in
  id)
    if command -v python3 >/dev/null 2>&1; then python3 -m json.tool "$GH/identity/instance.json"; else cat "$GH/identity/instance.json"; fi
    ;;
  status)
    echo "— runtime    : $("$GH/bin/gent-node" --version 2>/dev/null || echo absent)"
    echo "— service    : $(systemctl --user is-active gent-node.service 2>/dev/null || echo inconnu)"
    echo "— santé HTTP : $(curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || echo injoignable)"
    ;;
  serve)
    mkdir -p "$GH/cache/v8"
    export GENT_HOME="$GH" PORT NODE_COMPILE_CACHE="$GH/cache/v8"
    exec "$NODE_BIN" --max-semi-space-size=64 "$GH/app/gent-server.js"
    ;;
  build)   exec bash "$GH/scripts/gent-build.sh" ;;
  verify)  exec bash "$GH/scripts/gent-verify.sh" ;;
  open)    exec xdg-open "http://127.0.0.1:${PORT}" ;;
  help|*)
    cat <<USAGE
GENT — Node 22 Premium Founder Edition

  gent id        identité unique de l'instance (ID, build, machine)
  gent status    runtime + service + santé HTTP
  gent serve     serveur IDE au premier plan (port ${PORT})
  gent build     build Premium (intégrité, compile-cache, tarball dist)
  gent verify    protocole senior de vérification
  gent open      ouvrir l'IDE dans le navigateur

Instance : $GH · Port : ${PORT}
USAGE
    ;;
esac
GENT_CLI_EOF

  chmod 700 "$GENT_HOME/bin/gent-node" "$GENT_HOME/bin/gent-npm" "$GENT_HOME/bin/gent-npx" "$GENT_HOME/bin/gent"
  ok "Wrappers PFE écrits : gent-node / gent-npm / gent-npx / gent"
}

# --------------------------------------------- 3. application IDE embarquée ---
write_app() {
  cat > "$GENT_HOME/app/gent-server.js" <<'GENT_SERVER_EOF'
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
GENT_SERVER_EOF

  cat > "$GENT_HOME/workspace/GENT-BIENVENUE.md" <<'GENT_WELCOME_EOF'
# GENT — Workspace de l'instance

Cet espace est la racine sandboxée de l'IDE : chaque fichier lu, écrit ou
exécuté via l'API reste confiné ici (modèle de permission Node 22).

Bienvenue, Founder.
GENT_WELCOME_EOF

  ok "Application IDE écrite : app/gent-server.js (stdlib only, zéro dépendance)"
}

# ------------------------------------------- 4. identité unique d'instance ---
gen_hex() { od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'; }

write_identity() {
  local r now mid host arch kernel
  local inst_file="$GENT_HOME/identity/instance.json"
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  mid="$(cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null || echo unknown)"
  host="$(hostname 2>/dev/null || echo host)"
  case "$(uname -m)" in x86_64) arch="x64" ;; aarch64|arm64) arch="arm64" ;; *) arch="$(uname -m)" ;; esac
  kernel="$(uname -r)"

  local keep_id="" keep_tok="" keep_created=""
  if [ -f "$inst_file" ]; then
    keep_id="$(grep -o '"instance_id": *"[^"]*"' "$inst_file" | head -n1 | cut -d'"' -f4 || true)"
    keep_tok="$(grep -o '"auth_token": *"[^"]*"' "$inst_file" | head -n1 | cut -d'"' -f4 || true)"
    keep_created="$(grep -o '"created": *"[^"]*"' "$inst_file" | head -n1 | cut -d'"' -f4 || true)"
    ok "Identité existante conservée : ${keep_id:-?}"
  fi

  if [ -n "$keep_id" ]; then INSTANCE_ID="$keep_id"; else
    r="$(gen_hex 8)"; INSTANCE_ID="GENT-${r:0:4}-${r:4:4}-${r:8:4}-${r:12:4}"
  fi
  if [ -n "$keep_tok" ]; then AUTH_TOKEN="$keep_tok"; else AUTH_TOKEN="$(gen_hex 32)"; fi
  CREATED="${keep_created:-$now}"

  RUNTIME_SHA=""
  [ -x "$GENT_HOME/runtime/current/bin/node" ] && RUNTIME_SHA="$(sha256sum "$GENT_HOME/runtime/current/bin/node" | awk '{print $1}')"
  INSTALL_SHA=""
  [ -f "$SELF_PATH" ] && INSTALL_SHA="$(sha256sum "$SELF_PATH" 2>/dev/null | awk '{print $1}')"
  BUILD_ID="pfe.${GENT_NODE_VERSION#v}.bootstrap.$(date +%Y%m%d%H%M%S)"

  cat > "$inst_file" <<IDENT_EOF
{
  "schema": "gent.identity/1",
  "instance_id": "${INSTANCE_ID}",
  "auth_token": "${AUTH_TOKEN}",
  "channel": "founder-edition",
  "node": { "requested": "22", "version": "${GENT_NODE_VERSION:-unknown}", "runtime_sha256": "${RUNTIME_SHA}" },
  "host": { "hostname": "${host}", "machine_id": "${mid}", "arch": "${arch}", "kernel": "${kernel}" },
  "build_id": "${BUILD_ID}",
  "port": ${GENT_PORT},
  "home": "${GENT_HOME}",
  "created": "${CREATED}",
  "updated": "${now}",
  "integrity": { "install_script_sha256": "${INSTALL_SHA}" }
}
IDENT_EOF
  chmod 600 "$inst_file"
  printf '%s | %s | node=%s | install=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$BUILD_ID" "${GENT_NODE_VERSION:-unknown}" "${INSTALL_SHA:0:16}" >> "$GENT_HOME/identity/builds.log"
  chmod 600 "$GENT_HOME/identity/builds.log" 2>/dev/null || true
  ok "Identité unique générée : $INSTANCE_ID (jeton d'API scellé, chmod 600)"
}

# --------------------------------------------------- 5. scaffold dépôt Git ---
write_repo() {
  local REPO="$GENT_HOME/repo"
  mkdir -p "$REPO/app" "$REPO/bin" "$REPO/scripts" "$REPO/share"

  cp "$GENT_HOME/app/gent-server.js"   "$REPO/app/gent-server.js"
  cp "$GENT_HOME/bin/gent"             "$REPO/bin/gent"
  cp "$GENT_HOME/bin/gent-node"        "$REPO/bin/gent-node"
  cp "$GENT_HOME/bin/gent-npm"         "$REPO/bin/gent-npm"
  cp "$GENT_HOME/bin/gent-npx"         "$REPO/bin/gent-npx"
  [ -f "$GENT_HOME/share/gent.svg" ] && cp "$GENT_HOME/share/gent.svg" "$REPO/share/gent.svg"
  local s
  for s in gent-build.sh gent-git-push.sh gent-verify.sh; do
    [ -f "$SELF_DIR/$s" ] && cp "$SELF_DIR/$s" "$REPO/scripts/$s"
  done
  [ -f "$SELF_PATH" ] && cp "$SELF_PATH" "$REPO/scripts/gent-install.sh" 2>/dev/null || true

  cat > "$REPO/README.md" <<'GENT_README_EOF'
# GENT — Node 22 Premium Founder Edition

> Runtime souverain + IDE local. Node 22 LTS cloné, transformé, durci.
> Instance traçable par identité unique. Port dédié : 4310.

## Qu'est-ce que c'est

GENT prend les binaires officiels **Node.js 22 LTS**, les clone dans un
préfixe isolé (`~/gent`), puis les transforme en distribution **Premium
Founder Edition** :

- wrappers durcis (`gent-node`, `gent-npm`, `gent-npx`, `gent`) ;
- compile-cache V8 persistant (`NODE_COMPILE_CACHE`) → démarrages plus rapides ;
- **modèle de permission Node 22** sur le service (`--permission`) ;
- sandbox systemd (`NoNewPrivileges`, `PrivateTmp`, `ProtectSystem`, UMask 0077) ;
- **identité unique d'instance** (`GENT-xxxx-xxxx-xxxx-xxxx` + jeton d'API +
  machine-id) et registre de builds append-only ;
- IDE local souverain (100 % stdlib, zéro dépendance npm) sur `127.0.0.1:4310`.

## Installation

```bash
bash gent-install.sh            # port 4310 par défaut
gent status && gent open
```

## Cycle de build Premium

```bash
gent build                            # intégrité + warmup compile-cache + manifeste sha256 + tarball dist
bash ~/gent/scripts/gent-verify.sh    # protocole senior (9 contrôles)
```

## Pousser vers l'organisation GitHub

```bash
bash ~/gent/scripts/gent-git-push.sh MON-ORG gent-node22-pfe
```

## Identité & traçabilité

- `~/gent/identity/instance.json` — identité complète de l'instance ;
- `~/gent/identity/builds.log` — registre append-only des builds ;
- `~/gent/identity/manifests/*.sha256` — manifestes d'intégrité par build.

## Périmètre sacré

`~/Aether` est une zone **jamais lue, jamais écrite** par GENT. Le garde-fou
est codé dans l'installeur et vérifié par le protocole senior.

## Licence

MIT — GENT Founders.
GENT_README_EOF

  cat > "$REPO/LICENSE" <<'GENT_LICENSE_EOF'
MIT License

Copyright (c) 2026 GENT Founders

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
GENT_LICENSE_EOF

  cat > "$REPO/.gitignore" <<'GENT_GITIGNORE_EOF'
# secrets & données locales — JAMAIS poussés
identity/
cache/
logs/
runtime/
workspace/
dist/
selftest/
node_modules/
*.log
.env
GENT_GITIGNORE_EOF

  if command -v git >/dev/null 2>&1; then
    git -C "$REPO" init -q 2>/dev/null || true
    git -C "$REPO" symbolic-ref HEAD refs/heads/main 2>/dev/null || true
    git -C "$REPO" add -A
    git -C "$REPO" -c user.name="GENT PFE" -c user.email="gent@localhost" \
      commit -q -m "GENT — Node 22 Premium Founder Edition · bootstrap ${BUILD_ID:-pfe}" 2>/dev/null \
      && ok "Dépôt Git initialisé + commit initial (branche main)" \
      || ok "Dépôt Git déjà initialisé (aucun nouveau commit)"
  else
    warn "git absent — dépôt scaffoldé mais non initialisé"
  fi
  ok "Scaffold dépôt prêt : $REPO (README, LICENSE MIT, .gitignore anti-fuite)"
}

# --------------------------------------------------- 6. service + bureau ---
render_unit() {
  cat <<GENT_UNIT_EOF
[Unit]
Description=GENT Node22 Premium Founder Edition (port ${GENT_PORT})
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=PORT=${GENT_PORT}
Environment=NODE_ENV=production
Environment=GENT_HOME=${GENT_HOME}
Environment=NODE_COMPILE_CACHE=${GENT_HOME}/cache/v8
Environment=NODE_OPTIONS=--max-semi-space-size=64
WorkingDirectory=${GENT_HOME}/workspace
ExecStart=${GENT_HOME}/bin/gent-node --permission --allow-fs-read=${GENT_HOME} --allow-fs-write=${GENT_HOME} --allow-child-process --allow-worker ${GENT_HOME}/app/gent-server.js
Restart=always
RestartSec=3
TimeoutStopSec=10
KillSignal=SIGTERM
UMask=0077
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
StandardOutput=append:${GENT_HOME}/logs/service.log
StandardError=append:${GENT_HOME}/logs/service.log

[Install]
WantedBy=default.target
GENT_UNIT_EOF
}

write_service() {
  if [ "$SELFTEST" = 1 ]; then
    mkdir -p "$GENT_HOME/selftest"
    render_unit > "$GENT_HOME/selftest/gent-node.service"
    ok "[selftest] unité systemd rendue : selftest/gent-node.service"
    return
  fi

  local USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
  mkdir -p "$USER_DIR/systemd/user" "$GENT_HOME/logs"
  render_unit > "$USER_DIR/systemd/user/gent-node.service"
  chmod 600 "$USER_DIR/systemd/user/gent-node.service"

  if [ "$WITH_SERVICE" = 1 ] && systemctl --user daemon-reload >/dev/null 2>&1; then
    systemctl --user enable --now gent-node.service >/dev/null 2>&1 \
      && ok "Service systemd --user activé (autostart) : gent-node.service sur :$GENT_PORT" \
      || warn "enable a échoué — démarre manuellement : gent serve"
    loginctl enable-linger "$USER" >/dev/null 2>&1 \
      || sudo -n loginctl enable-linger "$USER" >/dev/null 2>&1 \
      || warn "linger non activé — pour un démarrage sans ouverture de session : sudo loginctl enable-linger $USER"
    SYSTEMD_OK=1
  else
    SYSTEMD_OK=0
    warn "systemd --user indisponible ou --no-service — repli : autostart de session"
    mkdir -p "$USER_DIR/autostart"
    cat > "$USER_DIR/autostart/gent-node.desktop" <<GENT_AUTO_EOF
[Desktop Entry]
Type=Application
Name=GENT Node22 PFE (service)
Exec=/bin/bash -lc 'exec ${GENT_HOME}/bin/gent serve'
Hidden=false
X-GNOME-Autostart-enabled=true
GENT_AUTO_EOF
    ok "Autostart de session installé : ~/.config/autostart/gent-node.desktop"
  fi
}

write_icon() {
  local ICON="$GENT_HOME/share/gent.svg"
  cat > "$ICON" <<'GENT_ICON_EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#00d4ff"/>
  </linearGradient></defs>
  <rect x="8" y="8" width="112" height="112" rx="26" fill="#0b0b10" stroke="#1e1e28" stroke-width="2"/>
  <rect x="8" y="8" width="112" height="112" rx="26" fill="none" stroke="url(#g)" stroke-width="3" opacity=".85"/>
  <text x="64" y="84" font-family="DejaVu Sans, sans-serif" font-size="60" font-weight="bold" text-anchor="middle" fill="url(#g)">G</text>
</svg>
GENT_ICON_EOF
  ok "Icône PFE générée : share/gent.svg"
}

write_desktop() {
  local ICON="$GENT_HOME/share/gent.svg"
  write_icon
  local DESK_ENTRY
  DESK_ENTRY="$(mktemp)"
  cat > "$DESK_ENTRY" <<GENT_DESK_EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=GENT — Node 22 Premium Founder Edition
Comment=IDE souverain Node 22 PFE · port ${GENT_PORT}
Exec=xdg-open http://127.0.0.1:${GENT_PORT}
Icon=${ICON}
Terminal=false
Categories=Development;IDE;
StartupNotify=true
GENT_DESK_EOF

  if [ "$SELFTEST" = 1 ]; then
    mkdir -p "$GENT_HOME/selftest"
    cp "$DESK_ENTRY" "$GENT_HOME/selftest/gent-founder.desktop"
    rm -f "$DESK_ENTRY"
    ok "[selftest] raccourci bureau rendu : selftest/gent-founder.desktop"
    return
  fi

  local APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  mkdir -p "$APP_DIR"
  cp "$DESK_ENTRY" "$APP_DIR/gent-founder.desktop"
  chmod 644 "$APP_DIR/gent-founder.desktop"
  ok "Entrée menu applications : gent-founder.desktop"

  local DESKTOPS=() d placed=0
  if command -v xdg-user-dir >/dev/null 2>&1; then
    d="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
    [ -n "$d" ] && [ -d "$d" ] && DESKTOPS+=("$d")
  fi
  [ -d "$HOME/Bureau" ]  && DESKTOPS+=("$HOME/Bureau")
  [ -d "$HOME/Desktop" ] && DESKTOPS+=("$HOME/Desktop")
  for d in "${DESKTOPS[@]}"; do
    cp "$DESK_ENTRY" "$d/gent-founder.desktop"
    chmod 755 "$d/gent-founder.desktop"
    gio set "$d/gent-founder.desktop" metadata::trusted true >/dev/null 2>&1 || true
    placed=1
  done
  rm -f "$DESK_ENTRY"
  if [ "$placed" = 1 ]; then
    ok "Raccourci bureau posé (Bureau/Desktop) — double-clic → IDE"
  else
    warn "aucun dossier bureau trouvé — lance : gent open"
  fi
}

# --------------------------------------------------------- 7. smoke tests ---
smoke() {
  log "Test de fumée — démarrage du serveur IDE…"
  local NODE_BIN="$GENT_HOME/runtime/current/bin/node"
  [ -x "$NODE_BIN" ] || NODE_BIN="$(command -v node || true)"
  [ -n "$NODE_BIN" ] || { warn "aucun node disponible pour le smoke test"; return 0; }

  NODE_BIN="$NODE_BIN" GENT_HOME="$GENT_HOME" PORT="$GENT_PORT" NODE_COMPILE_CACHE="$GENT_HOME/cache/v8" \
    setsid "$NODE_BIN" --max-semi-space-size=64 "$GENT_HOME/app/gent-server.js" >/tmp/gent-smoke.log 2>&1 &
  local pid=$! i healthy=0
  for i in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${GENT_PORT}/api/health" >/dev/null 2>&1; then healthy=1; break; fi
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.3
  done
  if [ "$healthy" = 1 ]; then
    ok "IDE opérationnel sur http://127.0.0.1:${GENT_PORT} (health 200)"
  else
    warn "health KO — voir /tmp/gent-smoke.log"
  fi
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

service_health() {
  local i
  for i in $(seq 1 20); do
    curl -fsS "http://127.0.0.1:${GENT_PORT}/api/health" >/dev/null 2>&1 && return 0
    sleep 0.4
  done
  return 1
}

# ------------------------------------------------------------- exécution ---
if [ "$SELFTEST" = 1 ]; then
  GENT_NODE_VERSION="${GENT_NODE_VERSION:-v22.23.4-detected-au-vrai-deploiement}"
  write_wrappers
  write_app
  if command -v node >/dev/null 2>&1; then
    node --check "$GENT_HOME/app/gent-server.js" && ok "[selftest] node --check : app/gent-server.js valide"
  else
    warn "node absent du PATH — --check ignoré"
  fi
  write_identity
  write_icon
  write_repo
  write_service
  write_desktop
  log "SELFTEST TERMINÉ — artefacts sous $GENT_HOME/selftest/"
  exit 0
fi

install_runtime
write_wrappers
write_app
"$GENT_HOME/runtime/current/bin/node" --check "$GENT_HOME/app/gent-server.js" \
  || die "app/gent-server.js invalide (node --check)"
ok "node --check : app/gent-server.js valide"
write_identity
write_icon
write_repo
write_service
write_desktop

# CLI dans le PATH utilisateur
mkdir -p "$HOME/.local/bin"
ln -sf "$GENT_HOME/bin/gent" "$HOME/.local/bin/gent"
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ok "CLI disponible : gent (dans ~/.local/bin)" ;;
  *) warn "ajoute ~/.local/bin au PATH :  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc" ;;
esac

if [ "${SYSTEMD_OK:-0}" = 1 ]; then
  if service_health; then
    ok "Service systemd en ligne — health 200 sur :$GENT_PORT"
  else
    warn "service démarré mais health KO — journal : journalctl --user -u gent-node.service -n 50"
  fi
else
  smoke
fi

cat <<SUMMARY

  ══════════════════════════════════════════════════════════════════
   GENT · NODE 22 PREMIUM FOUNDER EDITION — INSTALLATION TERMINÉE
  ══════════════════════════════════════════════════════════════════
   Instance ID   : $INSTANCE_ID
   Build         : $BUILD_ID
   Runtime       : ${GENT_NODE_VERSION} (clone officiel vérifié SHA256)
   IDE           : http://127.0.0.1:${GENT_PORT}
   Préfixe isolé : $GENT_HOME
   Identité      : $GENT_HOME/identity/instance.json (+ builds.log)
   Dépôt Git     : $GENT_HOME/repo  (prêt à pousser)
   Service       : systemctl --user status gent-node.service
   Zone sacrée   : ~/Aether INTACTE (aucune écriture, par conception)

   Commandes :
     gent id          identité de l'instance
     gent status      runtime + service + santé
     gent build       build Premium (intégrité + dist)
     gent verify      protocole senior
     gent open        ouvrir l'IDE
   GitHub :
     bash $GENT_HOME/scripts/gent-git-push.sh MON-ORG gent-node22-pfe
  ══════════════════════════════════════════════════════════════════

SUMMARY
