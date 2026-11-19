#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scaffolds.py — NERCEL v10 : générateurs de projets réels et déployables.
Chaque template produit des fichiers complets, détectables par NERCEL
(detect_framework) et lançables par _runtime_cmd : `npm start`, python, static.
"""
import os

# ---------------------------------------------------------------- helpers
def _w(root, rel, content):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p) or root, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)

SCAFFOLDS = []

# ---------------------------------------------------------------- Next.js
SCAFFOLDS.append({
    "id": "nextjs", "name": "Next.js 15 (App Router)", "framework": "Next.js",
    "desc": "App Router + Tailwind — buildé et servi par NERCEL (npm run start).",
    "files": {
        "package.json": """{
  "name": "nercel-nextjs-app",
  "version": "1.0.0",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start -p ${PORT:-3000}" },
  "dependencies": { "next": "^15.0.0", "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": { "tailwindcss": "^4.0.0", "@tailwindcss/postcss": "^4.0.0", "postcss": "^8.4.0" }
}
""",
        "app/layout.js": """import "./globals.css";
export const metadata = { title: "Next.js on NERCEL", description: "Généré par NERCEL v10" };
export default function RootLayout({ children }) {
  return (<html lang="fr"><body className="min-h-screen bg-neutral-950 text-neutral-100">{children}</body></html>);
}
""",
        "app/page.js": """export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold tracking-tight">▲ Next.js sur NERCEL</h1>
      <p className="text-neutral-400">Déployé et buildé par la plateforme — v10</p>
      <a href="https://nextjs.org/docs" className="rounded bg-white/10 px-4 py-2 hover:bg-white/20">Documentation →</a>
    </main>
  );
}
""",
        "app/globals.css": '@import "tailwindcss";\n',
        "postcss.config.mjs": """const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
""",
        "next.config.mjs": "const nextConfig = { output: undefined };\nexport default nextConfig;\n",
        ".gitignore": "node_modules/\n.next/\n",
    }})

# ---------------------------------------------------------------- React-Vite
SCAFFOLDS.append({
    "id": "react-vite", "name": "React + Vite", "framework": "React",
    "desc": "SPA React 19 avec Vite — build de prod servi par NERCEL.",
    "files": {
        "package.json": """{
  "name": "nercel-react-app",
  "version": "1.0.0",
  "private": true,
  "scripts": { "dev": "vite", "build": "vite build", "start": "npx serve dist -l ${PORT:-3000} -s" },
  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.0", "vite": "^6.0.0", "serve": "^14.2.0" }
}
""",
        "vite.config.js": """import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
""",
        "index.html": """<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>React sur NERCEL</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
""",
        "src/main.jsx": """import React from "react";
import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")).render(
  <main style={{fontFamily:"system-ui",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0a0a0a",color:"#fafafa",gap:12}}>
    <h1 style={{fontSize:"2.5rem",margin:0}}>⚡ React sur NERCEL</h1>
    <p style={{color:"#a3a3a3"}}>Vite + React 19 — build de prod servi par la plateforme</p>
  </main>
);
""",
        ".gitignore": "node_modules/\ndist/\n",
    }})

# ---------------------------------------------------------------- Express
SCAFFOLDS.append({
    "id": "express", "name": "API Express", "framework": "Node",
    "desc": "API REST Express avec health-check — npm start direct.",
    "files": {
        "package.json": """{
  "name": "nercel-express-api",
  "version": "1.0.0",
  "private": true,
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.21.0" }
}
""",
        "server.js": """const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.get("/", (req, res) => res.json({ app: "nercel-express-api", version: "1.0.0", runtime: "NERCEL v10" }));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.get("/api/hello/:name", (req, res) => res.json({ message: `Bonjour ${req.params.name} !` }));
app.listen(PORT, "0.0.0.0", () => console.log(`API sur :${PORT}`));
""",
        ".gitignore": "node_modules/\n",
    }})

# ---------------------------------------------------------------- Flask
SCAFFOLDS.append({
    "id": "flask", "name": "API Flask", "framework": "Flask",
    "desc": "API Python Flask + requirements — runtime Python auto.",
    "files": {
        "requirements.txt": "flask>=3.0\n",
        "app.py": """from flask import Flask, jsonify
import os, time

app = Flask(__name__)
START = time.time()

@app.route("/")
def home():
    return jsonify(app="nercel-flask-api", version="1.0.0", runtime="NERCEL v10")

@app.route("/health")
def health():
    return jsonify(status="ok", uptime=round(time.time() - START, 1))

@app.route("/api/hello/<name>")
def hello(name):
    return jsonify(message=f"Bonjour {name} !")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 3000)))
""",
    }})

# ---------------------------------------------------------------- FastAPI
SCAFFOLDS.append({
    "id": "fastapi", "name": "API FastAPI", "framework": "FastAPI",
    "desc": "API FastAPI + Uvicorn — docs auto /docs.",
    "files": {
        "requirements.txt": "fastapi>=0.115\nuvicorn>=0.32\n",
        "app.py": """import os, time
from fastapi import FastAPI

app = FastAPI(title="nercel-fastapi", version="1.0.0")
START = time.time()

@app.get("/")
def home():
    return {"app": "nercel-fastapi", "runtime": "NERCEL v10"}

@app.get("/health")
def health():
    return {"status": "ok", "uptime": round(time.time() - START, 1)}

@app.get("/api/hello/{name}")
def hello(name: str):
    return {"message": f"Bonjour {name} !"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 3000)))
""",
    }})

# ---------------------------------------------------------------- Static
SCAFFOLDS.append({
    "id": "static", "name": "Site statique", "framework": "Static",
    "desc": "Landing responsive — servi instantanément (zéro build).",
    "files": {
        "index.html": """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Statique sur NERCEL</title>
<style>
  *{margin:0;box-sizing:border-box}
  body{font-family:system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#fafafa}
  .card{max-width:640px;padding:48px 32px;text-align:center}
  h1{font-size:clamp(2rem,6vw,3.5rem);margin-bottom:12px}
  p{color:#a3a3a3;line-height:1.6}
  .pill{display:inline-block;margin-top:20px;padding:8px 16px;border:1px solid #333;border-radius:99px;font-size:.85rem;color:#38bdf8}
</style>
</head>
<body>
  <div class="card">
    <h1>🚀 Site statique sur NERCEL</h1>
    <p>Servi instantanément par la plateforme — zéro build, zéro configuration.<br>Responsive, prêt pour la prod.</p>
    <span class="pill">NERCEL v10</span>
  </div>
</body>
</html>
""",
    }})

# ---------------------------------------------------------------- Python CLI
SCAFFOLDS.append({
    "id": "python-cli", "name": "CLI Python", "framework": "Python",
    "desc": "Outil CLI Python packagé (main.py + pyproject).",
    "files": {
        "main.py": """#!/usr/bin/env python3
import argparse, sys

def main():
    p = argparse.ArgumentParser(prog="monoutil", description="CLI généré par NERCEL v10")
    p.add_argument("cible", nargs="?", default="monde", help="qui saluer")
    p.add_argument("-n","--nombre", type=int, default=1, help="nombre de répétitions")
    a = p.parse_args()
    for _ in range(a.nombre):
        print(f"Bonjour {a.cible} !")

if __name__ == "__main__":
    sys.exit(main())
""",
        "pyproject.toml": """[project]
name = "monoutil"
version = "1.0.0"
requires-python = ">=3.9"
[project.scripts]
monoutil = "main:main"
""",
        "requirements.txt": "",
    }})

# ---------------------------------------------------------------- API
def list_scaffolds():
    return [{"id": s["id"], "name": s["name"], "framework": s["framework"], "desc": s["desc"],
             "files": len(s["files"])} for s in SCAFFOLDS]

def generate(scaffold_id, target_dir, name="mon-projet"):
    s = next((x for x in SCAFFOLDS if x["id"] == scaffold_id), None)
    if not s: return None, f"template inconnu : {scaffold_id}"
    os.makedirs(target_dir, exist_ok=True)
    pkg = s["files"].get("package.json")
    if pkg:
        pkg = pkg.replace("nercel-nextjs-app", name).replace("nercel-react-app", name) \
                 .replace("nercel-express-api", name)
        _w(target_dir, "package.json", pkg)
        for rel, content in s["files"].items():
            if rel == "package.json": continue
            _w(target_dir, rel, content)
    else:
        for rel, content in s["files"].items():
            _w(target_dir, rel, content)
    return {"id": s["id"], "name": name, "framework": s["framework"],
            "files": len(s["files"]), "dir": target_dir}, None

if __name__ == "__main__":
    import json, sys
    if len(sys.argv) > 2:
        info, err = generate(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "mon-projet")
        print(json.dumps(info or {"error": err}, indent=2))
    else:
        print(json.dumps(list_scaffolds(), indent=2))
