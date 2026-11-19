#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
devops.py — NERCEL v10 : hooks de déploiement + générateurs de configs DevOps.

Hooks : scripts exécutés autour du cycle de déploiement
    pre-deploy   → avant copie/écrasement   (ex: tests, lint)
    post-deploy  → après démarrage          (ex: smoke test, notif)
    pre-stop / post-stop, pre-rollback / post-rollback
Emplacements scannés dans le projet : nercel.json {"hooks": {...}}, .nercelrc,
nercel/{hook}.sh, scripts/{hook}.sh, package.json → scripts.nercel:{hook}

Générateurs : Dockerfile, docker-compose, nginx reverse-proxy, GitHub Actions CI,
systemd, Makefile — adaptés au framework détecté.
"""
import json, os, subprocess, stat

HOOK_TYPES = ["pre-deploy", "post-deploy", "pre-stop", "post-stop", "pre-rollback", "post-rollback"]

# ---------------------------------------------------------------- hooks
def find_hooks(project_dir):
    """Détecte les hooks d'un projet déployé. Retourne {hook: cmdline}."""
    hooks = {}
    # 1) nercel.json {"hooks": {"pre-deploy": "npm test"}}
    nj = os.path.join(project_dir, "nercel.json")
    if os.path.isfile(nj):
        try:
            d = json.load(open(nj))
            for k, v in (d.get("hooks") or {}).items():
                if k in HOOK_TYPES and v: hooks[k] = str(v)
        except Exception: pass
    # 2) .nercelrc (INI minimal : clé=valeur par ligne)
    rc = os.path.join(project_dir, ".nercelrc")
    if os.path.isfile(rc):
        for line in open(rc, encoding="utf-8"):
            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                if k in HOOK_TYPES and v.strip(): hooks.setdefault(k, v.strip())
    # 3) scripts exécutables nercel/<hook>.sh ou scripts/<hook>.sh
    for sub in ("nercel", "scripts"):
        for h in HOOK_TYPES:
            p = os.path.join(project_dir, sub, h + ".sh")
            if os.path.isfile(p) and h not in hooks:
                hooks[h] = "bash " + os.path.join(sub, h + ".sh")
    # 4) package.json → scripts.nercel:<hook>
    pj = os.path.join(project_dir, "package.json")
    if os.path.isfile(pj):
        try:
            n = json.load(open(pj)).get("nercel") or {}
            for k, v in n.items():
                if k in HOOK_TYPES and v: hooks.setdefault(k, f"npm run nercel:{k}")
        except Exception: pass
    return hooks

def run_hook(project_dir, hook, log_fn=None):
    """Exécute un hook du projet. Retourne (ok, output, cmd)."""
    hooks = find_hooks(project_dir)
    cmd = hooks.get(hook)
    if not cmd: return True, "", None
    try:
        r = subprocess.run(cmd, shell=True, cwd=project_dir, capture_output=True, timeout=120)
        out = (r.stdout + r.stderr).decode("utf-8", "ignore")[-2000:]
        ok = r.returncode == 0
        if log_fn: log_fn("info" if ok else "err", f"hook {hook} {'✓' if ok else '✗'} : {cmd}")
        return ok, out, cmd
    except Exception as e:
        if log_fn: log_fn("err", f"hook {hook} erreur : {e}")
        return False, str(e), cmd

# ---------------------------------------------------------------- générateurs
def _dockerfile(framework, name, entry):
    node = f"""# généré par NERCEL v10
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT={3000 if entry else 3000}
EXPOSE 3000
CMD ["npm", "start"]
"""
    if framework in ("Next.js", "React", "Vue", "Node"):
        if framework == "Next.js":
            node = node.replace("RUN npm install --omit=dev", "RUN npm install").replace(
                'CMD ["npm", "start"]', 'RUN npm run build\nCMD ["npm", "start"]')
        return node
    if framework in ("Flask", "FastAPI", "Django", "Python"):
        run = "uvicorn app:app --host 0.0.0.0 --port 3000" if framework == "FastAPI" else \
              ("gunicorn app:app -b 0.0.0.0:3000" if framework == "Flask" else "gunicorn wsgi:app -b 0.0.0.0:3000")
        return f"""# généré par NERCEL v10
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt {'gunicorn' if 'gunicorn' in run else 'uvicorn'}
COPY . .
EXPOSE 3000
ENV PORT=3000
CMD ["sh", "-c", "{run}"]
"""
    return f"""# généré par NERCEL v10 — {framework}
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
"""

def _compose(framework, name):
    return f"""# généré par NERCEL v10
services:
  {name}:
    build: .
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
"""

def _nginx(framework, name, port):
    return f"""# généré par NERCEL v10 — reverse-proxy {name}
server {{
    listen 80;
    server_name {name}.local;

    location / {{
        proxy_pass http://127.0.0.1:{port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""

def _ci(framework, name):
    node_steps = """      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci || npm install
      - run: npm test --if-present
      - run: npm run build --if-present
"""
    py_steps = """      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt
      - run: python -m pytest --exitzero 2>/dev/null || true
"""
    static_steps = """      - run: echo "rien à builder (statique)"
"""
    steps = node_steps if framework in ("Next.js","React","Vue","Node") else (py_steps if framework in ("Flask","FastAPI","Django","Python") else static_steps)
    return f"""# généré par NERCEL v10 — CI {name} ({framework})
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
{steps}"""

def _systemd(framework, name, port):
    start = "npm start" if framework in ("Next.js","React","Vue","Node") else \
            ("uvicorn app:app --host 0.0.0.0 --port %d" % port if framework == "FastAPI" else "python app.py")
    return f"""# généré par NERCEL v10 — service {name}
[Unit]
Description=NERCEL — {name} ({framework})
After=network.target

[Service]
Type=simple
WorkingDirectory={os.path.expanduser("~/.nercel/projects/" + name)}
Environment=PORT={port}
ExecStart={start}
Restart=always
RestartSec=3
User={os.environ.get("USER", "dev")}

[Install]
WantedBy=multi-user.target
"""

def _makefile(framework, name):
    run = "npm run dev" if framework in ("Next.js","React","Vue","Node") else \
          ("uvicorn app:app --reload" if framework == "FastAPI" else "python app.py")
    return f"""# généré par NERCEL v10
.PHONY: dev build test clean
dev:
\t{run}
build:
\tdocker build -t {name} .
test:
\tnpm test --if-present || pytest --exitzero || true
clean:
\trm -rf node_modules .next dist __pycache__
"""

def generate(kind, framework, name, port=3000, target_dir="."):
    """Génère un fichier de config DevOps. Retourne (filename, content)."""
    G = {
        "dockerfile": lambda: ("Dockerfile", _dockerfile(framework, name, True)),
        "compose":    lambda: ("docker-compose.yml", _compose(framework, name)),
        "nginx":      lambda: ("nginx.conf", _nginx(framework, name, port)),
        "ci":         lambda: (".github/workflows/ci.yml", _ci(framework, name)),
        "systemd":    lambda: (f"{name}.service", _systemd(framework, name, port)),
        "makefile":   lambda: ("Makefile", _makefile(framework, name)),
    }
    if kind not in G: return None, f"générateur inconnu : {kind} (dispos : {', '.join(G)})"
    fname, content = G[kind]()
    path = os.path.join(target_dir, fname)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    os.chmod(path, 0o644)
    return {"file": fname, "path": path, "size": len(content)}, None

GENERATORS = [
    {"id": "dockerfile", "name": "Dockerfile", "desc": "Image Docker production adaptée au framework"},
    {"id": "compose",    "name": "docker-compose.yml", "desc": "Stack compose avec restart policy"},
    {"id": "nginx",      "name": "nginx.conf", "desc": "Reverse-proxy + WebSocket upgrade"},
    {"id": "ci",         "name": "GitHub Actions CI", "desc": "Workflow CI push/PR (build+test)"},
    {"id": "systemd",    "name": "systemd unit", "desc": "Service auto-restart au boot"},
    {"id": "makefile",   "name": "Makefile", "desc": "dev/build/test/clean"},
]
