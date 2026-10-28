#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# ██╗  ██╗██████╗  ███████╗ ██████╗ ███████╗██╗███████╗██╗   ██╗███████╗██████╗
# ██║ ██╔╝██╔══██╗██╔════╝██╔═══██╗██╔════╝██║██╔════╝██║   ██║██╔════╝██╔══██╗
# █████╔╝ ██████╔╝███████╗██║   ██║█████╗  ██║█████╗  ██║   ██║█████╗  ██████╔╝
# ██╔═██╗ ██╔══██╗╚════██║██║   ██║██╔══╝  ██║██╔══╝  ╚██╗ ██╔╝██╔══╝  ██╔══██╗
# ██║  ██╗██████╔╝███████║╚██████╔╝██║     ██║███████╗ ╚████╔╝ ███████╗██║  ██║
# ╚═╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝
# ═════════════════════════════════════════════════════════════════════════════
# NEXUS PLASMA STUDIO — Linus Edition v3.0.0
# ═════════════════════════════════════════════════════════════════════════════
# Monolithic Markdown Studio · Stdlib Only · Zero Deps · 100% Local
#
# "If you can't ship it in one file, you don't understand it."
#
#   · 100% stdlib       · zero pip install     · zero node_modules
#   · 100% local        · zero telemetry        · zero cloud
#   · 100% yours        · zero SaaS             · zero subscriptions
#   · 100% monolith     · zero microservices   · zero npm
#
# Le browser est l'UI.  Python est le backend.  Bash est le launcher.
# Rust est le muscle.    SQLite est la mémoire. Ça, c'est toute la stack.
#
# Author : Aissa Mohammedi (DGK)
# License: NEXUS-OPEN-3.0
# Port   : 2009 (override with PLASMA_PORT=...)
# ═════════════════════════════════════════════════════════════════════════════

set -euo pipefail

VERSION="3.0.0-linus"
CODENAME="Plasma Monolith"

# ─── detect python ─────────────────────────────────────────────────────────
PYBIN=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PYBIN="$cmd"; break
  fi
done
if [[ -z "$PYBIN" ]]; then
  echo "✗ Python 3 requis (introuvable dans PATH). Installe-le : https://www.python.org/" >&2
  exit 1
fi
PYVER="$("$PYBIN" -c 'import sys; print("%d.%d.%d" % sys.version_info[:3])')"
echo "✓ Python détecté : $PYBIN ($PYVER)"

# ─── cache ─────────────────────────────────────────────────────────────────
CACHE_DIR="${PLASMA_CACHE:-${HOME}/.cache/nexus-plasma}"
mkdir -p "$CACHE_DIR"
PY_FILE="$CACHE_DIR/plasma.py"
RS_FILE="$CACHE_DIR/plasma_bench.rs"
RS_BIN="$CACHE_DIR/plasma_bench"

# ─── extract embedded python ──────────────────────────────────────────────
extract_python() {
  echo "→ Extraction du module Python embarqué..."
  cat > "$PY_FILE" <<'__PYTHON_EOF__'
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
NEXUS PLASMA STUDIO — Linus Edition v3.0.0
═══════════════════════════════════════════════════════════════════════════════
Monolithic Markdown Studio · Stdlib Only · Zero Deps · 100% Local

Features:
  • Live preview (client-side marked.js + KaTeX + highlight.js)
  • Vim mode (toggleable, hjkl/dd/yy/p/:w/:x/i/a/o)
  • 4 themes (Cyberpunk / Gruvbox / Solarized / Ghost)
  • Slides mode (markdown -> slides via reveal.js-style)
  • Diff viewer (between current and backup)
  • System stats panel (CPU / mem / disk / threads)
  • Find & replace with regex
  • Live outline (TOC auto-extracted from H1-H3)
  • Word count + reading time
  • Standalone HTML export (inlined CSS)
  • File watcher (detect external edits)
  • Git auto-commit on save (optional, if git available)
  • Rust benchmarker (optional, if rustc available)
  • 6 markdown templates
  • SQLite persistence + history
  • Auto-backup before every save
  • AST-whitelist calculator (no eval)
  • Path traversal protection
  • Health endpoint (/api/health)
  • Manifesto on launch

Author : Aissa Mohammedi (DGK)
License: NEXUS-OPEN-3.0
Port   : 2009 (env PLASMA_PORT)
═══════════════════════════════════════════════════════════════════════════════
"""

import os
import sys
import re
import ast
import json
import math
import time
import uuid
import html
import shlex
import socket
import random
import hashlib
import sqlite3
import shutil
import datetime
import threading
import platform
import urllib.parse
import webbrowser
import subprocess
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from typing import Optional, List, Dict, Any, Tuple

# ═══════════════════════════════════════════════════════════════════════════════
# §0 — MANIFESTO (Linus mind)
# ═══════════════════════════════════════════════════════════════════════════════

MANIFESTO = r"""
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ███╗   ██╗██████╗  ██████╗ ███╗   ██╗██╗██╗  ███████╗████████╗              ║
║   ████╗  ██║██╔══██╗██╔═══██╗████╗  ██║██║██║  ██╔════╝╚══██╔══╝              ║
║   ██╔██╗ ██║██║  ██║██║   ██║██╔██╗ ██║██║██║  ███████╗   ██║                 ║
║   ██║╚██╗██║██║  ██║██║   ██║██║╚██╗██║██║██║  ╚════██║   ██║                 ║
║   ██║ ╚████║██████╔╝╚██████╔╝██║ ╚████║██║███████╗██████╔╝   ██║               ║
║   ╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═╝╚══════╝╚═════╝    ╚═╝               ║
║                                                                              ║
║   "If you can't ship it in one file, you don't understand it."               ║
║                                                                              ║
║   · 100% stdlib       · zero pip install     · zero node_modules            ║
║   · 100% local        · zero telemetry        · zero cloud                  ║
║   · 100% yours        · zero SaaS             · zero subscriptions          ║
║   · 100% monolith     · zero microservices    · zero npm                   ║
║                                                                              ║
║   The browser is the UI.    Python is the backend.    Bash is the launcher.  ║
║   Rust is muscle.    SQLite is memory.    That's the whole stack.           ║
║                                                                              ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

# ═══════════════════════════════════════════════════════════════════════════════
# §1 — CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

VERSION  = "3.0.0-linus"
CODENAME = "Plasma Monolith"
AUTEUR   = "Aissa Mohammedi (DGK)"
LICENCE  = "NEXUS-OPEN-3.0"
HOST     = os.environ.get("PLASMA_HOST", "127.0.0.1")
PORT     = int(os.environ.get("PLASMA_PORT", "2009"))

HOME     = Path.home()
BASE     = HOME / "Documents" / "nexus_workspace"
WORKSPACE= BASE / "documents"
ASSETS   = BASE / "assets"
EXPORTS  = BASE / "exports"
BACKUPS  = BASE / "backups"
LOGS     = BASE / "logs"
DB_FILE  = BASE / "workspace.db"

for _d in (BASE, WORKSPACE, ASSETS, EXPORTS, BACKUPS, LOGS):
    _d.mkdir(parents=True, exist_ok=True)

LOG_FILE    = LOGS / f"studio_{datetime.date.today().isoformat()}.log"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_HISTORY = 1000

# Rust bench binary (set by the bash launcher; falls back if absent)
RUST_BIN = Path(os.environ.get("PLASMA_RUST_BIN", str(BASE / ".cache" / "plasma_bench")))

# Git auto-commit toggle
GIT_AUTOCOMMIT = os.environ.get("PLASMA_GIT", "1") == "1"

# ═══════════════════════════════════════════════════════════════════════════════
# §2 — LOGGER
# ═══════════════════════════════════════════════════════════════════════════════

_LOG_LOCK = threading.RLock()

def log(level: str, msg: str) -> None:
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [{level:>5}] {msg}"
    try:
        print(line, flush=True)
    except Exception:
        pass
    with _LOG_LOCK:
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass

# ═══════════════════════════════════════════════════════════════════════════════
# §3 — DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

class WorkspaceDB:
    """SQLite-backed persistence. One connection per thread (WAL mode)."""

    def __init__(self, path: Path):
        self.path = str(path)
        self._lock = threading.RLock()
        self._local = threading.local()
        self._init()

    def _conn(self):
        if not hasattr(self._local, "conn"):
            c = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
            c.row_factory = sqlite3.Row
            c.execute("PRAGMA journal_mode=WAL")
            c.execute("PRAGMA synchronous=NORMAL")
            self._local.conn = c
        return self._local.conn

    def _init(self):
        with self._lock:
            c = self._conn()
            c.executescript("""
            CREATE TABLE IF NOT EXISTS files (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT UNIQUE NOT NULL,
                content     TEXT,
                hash        TEXT,
                size        INTEGER,
                words       INTEGER,
                created_at  TEXT,
                updated_at  TEXT
            );
            CREATE TABLE IF NOT EXISTS history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name   TEXT,
                action      TEXT,
                old_hash    TEXT,
                new_hash    TEXT,
                timestamp   TEXT
            );
            CREATE TABLE IF NOT EXISTS sessions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT UNIQUE,
                started_at  TEXT,
                last_active TEXT,
                ops_count   INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_files_name    ON files(name);
            CREATE INDEX IF NOT EXISTS idx_history_file  ON history(file_name);
            CREATE INDEX IF NOT EXISTS idx_history_ts    ON history(timestamp);
            """)
            c.commit()

    def upsert_file(self, name: str, content: str) -> Dict:
        h = hashlib.sha256(content.encode()).hexdigest()
        size = len(content.encode())
        words = len(re.findall(r"\b\w+\b", content))
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with self._lock:
            c = self._conn()
            existing = c.execute("SELECT * FROM files WHERE name=?", (name,)).fetchone()
            old_hash = existing["hash"] if existing else None
            if existing:
                c.execute(
                    "UPDATE files SET content=?, hash=?, size=?, words=?, updated_at=? WHERE name=?",
                    (content, h, size, words, now, name),
                )
            else:
                c.execute(
                    "INSERT INTO files (name, content, hash, size, words, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                    (name, content, h, size, words, now, now),
                )
            # Trim history per file
            c.execute(
                "INSERT INTO history (file_name, action, old_hash, new_hash, timestamp) VALUES (?,?,?,?,?)",
                (name, "save", old_hash, h, now),
            )
            c.execute(
                "DELETE FROM history WHERE id NOT IN "
                "(SELECT id FROM history ORDER BY id DESC LIMIT ?)",
                (MAX_HISTORY,),
            )
            c.commit()
        return {"hash": h, "size": size, "words": words,
                "action": "updated" if existing else "created"}

    def get_file(self, name: str) -> Optional[Dict]:
        with self._lock:
            row = self._conn().execute("SELECT * FROM files WHERE name=?", (name,)).fetchone()
            return dict(row) if row else None

    def list_files(self) -> List[Dict]:
        with self._lock:
            rows = self._conn().execute(
                "SELECT name, size, words, hash, updated_at FROM files ORDER BY updated_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def delete_file(self, name: str) -> bool:
        with self._lock:
            c = self._conn()
            c.execute("DELETE FROM files WHERE name=?", (name,))
            c.execute(
                "INSERT INTO history (file_name, action, timestamp) VALUES (?,?,?)",
                (name, "delete", datetime.datetime.now(datetime.timezone.utc).isoformat()),
            )
            c.commit()
            return True

    def search(self, query: str) -> List[Dict]:
        with self._lock:
            rows = self._conn().execute(
                "SELECT name, content, updated_at FROM files WHERE name LIKE ? OR content LIKE ? LIMIT 50",
                (f"%{query}%", f"%{query}%"),
            ).fetchall()
            return [dict(r) for r in rows]

    def history(self, limit: int = 50) -> List[Dict]:
        with self._lock:
            rows = self._conn().execute(
                "SELECT * FROM history ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]

    def file_history(self, name: str, limit: int = 20) -> List[Dict]:
        with self._lock:
            rows = self._conn().execute(
                "SELECT * FROM history WHERE file_name=? ORDER BY id DESC LIMIT ?",
                (name, limit),
            ).fetchall()
            return [dict(r) for r in rows]


DB = WorkspaceDB(DB_FILE)

# ═══════════════════════════════════════════════════════════════════════════════
# §4 — SAFE CALCULATOR (AST whitelist)
# ═══════════════════════════════════════════════════════════════════════════════

class SafeCalculator:
    SAFE_FUNCTIONS = {
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "asin": math.asin, "acos": math.acos, "atan": math.atan,
        "atan2": math.atan2, "sinh": math.sinh, "cosh": math.cosh,
        "tanh": math.tanh, "sqrt": math.sqrt, "exp": math.exp,
        "log": math.log, "log10": math.log10, "log2": math.log2,
        "floor": math.floor, "ceil": math.ceil, "fabs": math.fabs,
        "factorial": math.factorial, "gcd": math.gcd, "lcm": math.lcm,
        "comb": math.comb, "perm": math.perm,
        "degrees": math.degrees, "radians": math.radians,
        "hypot": math.hypot, "isqrt": math.isqrt,
    }
    SAFE_CONSTANTS = {
        "pi": math.pi, "e": math.e, "tau": math.tau, "inf": math.inf,
    }

    def evaluate(self, expr: str) -> Dict:
        if not expr or len(expr) > 500:
            return {"ok": False, "error": "expression invalide ou trop longue"}
        try:
            tree = ast.parse(expr, mode="eval")
            result = self._eval_node(tree.body)
            return {"ok": True, "result": result, "expr": expr}
        except ZeroDivisionError:
            return {"ok": False, "error": "division par zéro"}
        except Exception as e:
            return {"ok": False, "error": str(e)[:100]}

    def _eval_node(self, node):
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float, complex)):
                return node.value
            raise ValueError("constante non numérique")
        if isinstance(node, ast.Name):
            if node.id in self.SAFE_CONSTANTS:
                return self.SAFE_CONSTANTS[node.id]
            raise ValueError(f"nom inconnu: {node.id}")
        if isinstance(node, ast.BinOp):
            l = self._eval_node(node.left)
            r = self._eval_node(node.right)
            if isinstance(node.op, ast.Add):  return l + r
            if isinstance(node.op, ast.Sub):  return l - r
            if isinstance(node.op, ast.Mult): return l * r
            if isinstance(node.op, ast.Div):  return l / r
            if isinstance(node.op, ast.FloorDiv): return l // r
            if isinstance(node.op, ast.Mod):  return l % r
            if isinstance(node.op, ast.Pow):  return l ** r
            raise ValueError("opérateur non autorisé")
        if isinstance(node, ast.UnaryOp):
            v = self._eval_node(node.operand)
            if isinstance(node.op, ast.USub): return -v
            if isinstance(node.op, ast.UAdd): return +v
            raise ValueError("opérateur unaire non autorisé")
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name):
                raise ValueError("appel non autorisé")
            fn_name = node.func.id
            if fn_name not in self.SAFE_FUNCTIONS:
                raise ValueError(f"fonction non autorisée: {fn_name}")
            args = [self._eval_node(a) for a in node.args]
            return self.SAFE_FUNCTIONS[fn_name](*args)
        raise ValueError(f"noeud AST non autorisé: {type(node).__name__}")


CALC = SafeCalculator()

# ═══════════════════════════════════════════════════════════════════════════════
# §5 — TEMPLATES
# ═══════════════════════════════════════════════════════════════════════════════

TEMPLATES = {
    "readme": """# 🚀 Nom du projet

[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

> Une phrase qui résume le projet.

---

## ✨ Fonctionnalités

- ✅ Fonctionnalité 1
- ✅ Fonctionnalité 2
- ✅ Fonctionnalité 3

## 📦 Installation

```bash
git clone https://github.com/user/project.git
cd project
npm install
```

## 🚀 Usage

```bash
npm start
```

## 📐 Architecture

```mermaid
graph LR
A[Client] --> B[API]
B --> C[Database]
```

## 🤝 Contribution

Voir CONTRIBUTING.md.

## 📄 Licence

MIT — voir LICENSE.
""",
    "blog": """# Titre de l'article

> Publié le {date} · 5 min de lecture

## Introduction

Un paragraphe d'introduction qui accroche le lecteur.

## Section 1

Contenu de la section 1.

### Sous-section

Détails ici.

## Section 2

Contenu de la section 2.

> Une citation mémorable.

## Conclusion

La synthèse et l'appel à l'action.
""",
    "documentation": """# Documentation

## Table des matières

1. Installation
2. Configuration
3. API

## Installation

Instructions d'installation.

## Configuration

```yaml
key: value
```

## API

### `GET /api/endpoint`

Description de l'endpoint.

Réponse :

```json
{"result": "success"}
```
""",
    "notes": """# Notes du {date}

## Idées

- Idée 1
- Idée 2
- Idée 3

## Tâches

- [ ] Tâche à faire
- [ ] Autre tâche
- [x] Tâche terminée

## Références

- Lien 1
- Lien 2
""",
    "math": """# Formules mathématiques

## Algèbre

$$f(x) = ax^2 + bx + c$$

## Analyse

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

## Séries

$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$
""",
    "code": """# Exemple de code

## Python

```python
def hello(name: str) -> str:
    \"\"\"Retourne un salutation.\"\"\"
    return f"Hello, {name}!"

if __name__ == "__main__":
    print(hello("World"))
```

## JavaScript

```javascript
const hello = (name) => `Hello, ${name}!`;
console.log(hello("World"));
```

## Rust

```rust
fn hello(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn main() {
    println!("{}", hello("World"));
}
```
""",
}

# ═══════════════════════════════════════════════════════════════════════════════
# §6 — BACKUP MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class BackupManager:
    def __init__(self, backup_dir: Path):
        self.dir = backup_dir
        self.dir.mkdir(parents=True, exist_ok=True)

    def backup(self, name: str, content: str) -> Path:
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        safe = name.replace("/", "_").replace("\\", "_")
        bf = self.dir / f"{safe}.{ts}.bak"
        bf.write_text(content, encoding="utf-8")
        log("INFO", f"backup: {bf.name} ({len(content)} bytes)")
        return bf

    def list_backups(self, name: Optional[str] = None) -> List[Dict]:
        result = []
        pattern = f"{name.replace('/', '_')}.*.bak" if name else "*.bak"
        for f in sorted(self.dir.glob(pattern), reverse=True):
            stats = f.stat()
            result.append({
                "name": f.name,
                "size": stats.st_size,
                "date": datetime.datetime.fromtimestamp(stats.st_mtime).isoformat(),
                "path": str(f),
            })
        return result

    def read_backup(self, backup_name: str) -> Optional[str]:
        p = self.dir / backup_name
        if not p.exists():
            return None
        return p.read_text(encoding="utf-8")

    def restore(self, backup_name: str, original_name: str) -> bool:
        content = self.read_backup(backup_name)
        if content is None:
            return False
        DB.upsert_file(original_name, content)
        log("OK", f"restored: {original_name} from {backup_name}")
        return True


BACKUP = BackupManager(BACKUPS)

# ═══════════════════════════════════════════════════════════════════════════════
# §7 — GIT MANAGER (auto-commit)
# ═══════════════════════════════════════════════════════════════════════════════

class GitManager:
    """Optional git auto-commit. Silent no-op if git is missing or repo init fails."""

    def __init__(self, root: Path):
        self.root = root
        self.git = shutil.which("git")
        self.enabled = bool(self.git) and GIT_AUTOCOMMIT
        self._init_repo()

    def _init_repo(self):
        if not self.enabled:
            return
        try:
            subprocess.run(
                [self.git, "init"], cwd=self.root,
                capture_output=True, check=False, timeout=5,
            )
            # Set local identity if missing (don't touch global config)
            cfg = subprocess.run(
                [self.git, "config", "user.name"],
                cwd=self.root, capture_output=True, text=True,
            )
            if not cfg.stdout.strip():
                subprocess.run(
                    [self.git, "config", "user.name", "Nexus Plasma"],
                    cwd=self.root, capture_output=True, check=False, timeout=5,
                )
                subprocess.run(
                    [self.git, "config", "user.email", "plasma@nexus.local"],
                    cwd=self.root, capture_output=True, check=False, timeout=5,
                )
            # .gitignore
            gi = self.root / ".gitignore"
            if not gi.exists():
                gi.write_text("*.bak\n*.log\n__pycache__/\n.db-wal\n.db-shm\n",
                              encoding="utf-8")
            log("OK", f"git ready at {self.root}")
        except Exception as e:
            log("WARN", f"git init failed: {e}")
            self.enabled = False

    def commit(self, message: str = "auto: save"):
        if not self.enabled:
            return False
        try:
            subprocess.run([self.git, "add", "-A"], cwd=self.root,
                           capture_output=True, check=False, timeout=10)
            r = subprocess.run(
                [self.git, "diff", "--cached", "--quiet"],
                cwd=self.root, capture_output=True, timeout=10,
            )
            if r.returncode == 0:
                return False  # nothing to commit
            subprocess.run(
                [self.git, "commit", "-m", message],
                cwd=self.root, capture_output=True, check=False, timeout=10,
            )
            return True
        except Exception as e:
            log("WARN", f"git commit failed: {e}")
            return False

    def log_short(self, limit: int = 10) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            r = subprocess.run(
                [self.git, "log", f"-{limit}", "--pretty=%h|%an|%ar|%s"],
                cwd=self.root, capture_output=True, text=True, timeout=5,
            )
            out = []
            for line in r.stdout.strip().splitlines():
                parts = line.split("|", 3)
                if len(parts) == 4:
                    out.append({"hash": parts[0], "author": parts[1],
                                "date": parts[2], "message": parts[3]})
            return out
        except Exception:
            return []


GIT = GitManager(WORKSPACE.parent)

# ═══════════════════════════════════════════════════════════════════════════════
# §8 — SYSTEM MONITOR (stdlib only)
# ═══════════════════════════════════════════════════════════════════════════════

class SystemMonitor:
    """CPU/mem/disk stats using only stdlib. CPU% is approximate (load avg)."""

    def snapshot(self) -> Dict:
        # Memory
        mem_total, mem_used = self._mem()

        # Disk
        try:
            statv = os.statvfs(self.root_or_cwd())
            disk_total = statv.f_frsize * statv.f_blocks
            disk_free  = statv.f_frsize * statv.f_bavail
        except Exception:
            disk_total = disk_free = 0

        # Load average
        try:
            load1, load5, load15 = os.getloadavg()
        except Exception:
            load1 = load5 = load15 = 0.0

        # CPU count
        try:
            cpu_count = os.cpu_count() or 1
        except Exception:
            cpu_count = 1

        # Threads
        try:
            import threading as _t
            threads = _t.active_count()
        except Exception:
            threads = 0

        return {
            "hostname": socket.gethostname(),
            "platform": platform.platform(),
            "python":   platform.python_version(),
            "cpu_count": cpu_count,
            "load":     [round(load1, 2), round(load5, 2), round(load15, 2)],
            "mem_total": mem_total,
            "mem_used":  mem_used,
            "mem_pct":   round(mem_used / mem_total * 100, 1) if mem_total else 0,
            "disk_total": disk_total,
            "disk_free":  disk_free,
            "disk_pct":   round((1 - disk_free / disk_total) * 100, 1) if disk_total else 0,
            "threads":  threads,
            "pid":      os.getpid(),
        }

    @staticmethod
    def root_or_cwd() -> str:
        return str(Path.home())

    @staticmethod
    def _mem() -> Tuple[int, int]:
        """Parse /proc/meminfo on Linux, fallback to resource module."""
        try:
            with open("/proc/meminfo", "r") as f:
                d = {}
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        k = parts[0].strip()
                        v = int(parts[1].strip().split()[0]) * 1024
                        d[k] = v
                total = d.get("MemTotal", 0)
                avail = d.get("MemAvailable", d.get("MemFree", 0))
                return total, total - avail
        except Exception:
            pass
        try:
            import resource
            rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            # ru_maxrss is in KB on Linux, bytes on macOS — assume KB
            return max(rss * 1024, 0), rss * 1024
        except Exception:
            return 0, 0


SYS = SystemMonitor()

# ═══════════════════════════════════════════════════════════════════════════════
# §9 — BENCHMARKER (Rust vs Python)
# ═══════════════════════════════════════════════════════════════════════════════

def _py_fib(n: int) -> int:
    if n < 2:
        return n
    a, b = 0, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b


class Benchmarker:
    """Compare Rust vs Python on a Fibonacci workload. Falls back to Python only."""

    def __init__(self, rust_bin: Path):
        self.rust_bin = rust_bin
        self.rust_ok  = rust_bin.exists() and os.access(rust_bin, os.X_OK)

    def run(self, n: int = 35) -> Dict:
        # Python
        t0 = time.perf_counter()
        py_result = _py_fib(n)
        py_ms = (time.perf_counter() - t0) * 1000

        out = {
            "n": n,
            "py_result": py_result,
            "py_ms": round(py_ms, 3),
            "rust_available": self.rust_ok,
        }

        if self.rust_ok:
            try:
                t0 = time.perf_counter()
                r = subprocess.run(
                    [str(self.rust_bin), str(n)],
                    capture_output=True, text=True, timeout=30,
                )
                rust_ms = (time.perf_counter() - t0) * 1000
                if r.returncode == 0:
                    data = json.loads(r.stdout.strip())
                    out["rust_result"] = data.get("result")
                    out["rust_ns"]    = data.get("ns")
                    out["rust_ms"]    = round(rust_ms, 3)
                    if py_ms > 0:
                        out["speedup"] = round(py_ms / (data.get("ns", 1) / 1e6), 1)
            except Exception as e:
                out["rust_error"] = str(e)[:100]
        return out


BENCH = Benchmarker(RUST_BIN)

# ═══════════════════════════════════════════════════════════════════════════════
# §10 — UTILS
# ═══════════════════════════════════════════════════════════════════════════════

def safe_filename(name: str) -> Optional[str]:
    """Sanitize file name to block path traversal."""
    if not name or len(name) > 200:
        return None
    name = name.strip()
    if not name.endswith(".md"):
        name += ".md"
    if "/" in name or "\\" in name or ".." in name:
        return None
    if not re.match(r'^[\w\-. ]+\.md$', name, re.UNICODE):
        return None
    return name


def format_size(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1024
    return f"{n:.1f} TB"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def extract_outline(text: str) -> List[Dict]:
    """Extract H1-H3 from markdown as a flat list (with level)."""
    out = []
    in_code = False
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        m = re.match(r'^(#{1,3})\s+(.+)$', s)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip().rstrip("#").strip()
            # slug
            slug = re.sub(r'[^\w\- ]', '', title.lower()).strip().replace(" ", "-")
            out.append({"level": level, "title": title, "slug": slug})
    return out


def count_words(text: str) -> Tuple[int, int]:
    """Returns (words, reading_time_minutes)."""
    words = len(re.findall(r'\b\w+\b', text))
    reading = max(1, round(words / 200))
    return words, reading


def render_markdown_to_html(text: str) -> str:
    """Server-side fallback renderer (used by /api/preview and slides export)."""
    # Escape HTML first
    s = html.escape(text)
    # Code blocks ```lang\ncode```
    s = re.sub(
        r'```(\w*)\n(.*?)```',
        lambda m: f'<pre><code class="lang-{m.group(1)}">{m.group(2)}</code></pre>',
        s, flags=re.DOTALL,
    )
    # Inline code `code`
    s = re.sub(r'`([^`\n]+)`', r'<code>\1</code>', s)
    # Headings
    s = re.sub(r'^###\s+(.+)$', r'<h3>\1</h3>', s, flags=re.MULTILINE)
    s = re.sub(r'^##\s+(.+)$',  r'<h2>\1</h2>', s, flags=re.MULTILINE)
    s = re.sub(r'^#\s+(.+)$',   r'<h1>\1</h1>', s, flags=re.MULTILINE)
    # Bold / italic
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'\*([^*]+)\*',     r'<em>\1</em>', s)
    # Links [text](url)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)
    # Blockquotes
    s = re.sub(r'^&gt;\s?(.+)$', r'<blockquote>\1</blockquote>', s, flags=re.MULTILINE)
    # Lists
    s = re.sub(r'^-\s+(.+)$', r'<li>\1</li>', s, flags=re.MULTILINE)
    s = re.sub(r'(<li>.*?</li>\n?)+', lambda m: f'<ul>{m.group(0)}</ul>', s, flags=re.DOTALL)
    # Paragraphs
    parts = s.split("\n\n")
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if p.startswith("<"):
            out.append(p)
        else:
            out.append(f"<p>{p.replace(chr(10), '<br>')}</p>")
    return "\n".join(out)


def html_export_standalone(name: str, content: str) -> str:
    """Wrap rendered markdown in a self-contained HTML doc."""
    rendered = render_markdown_to_html(content)
    words, reading = count_words(content)
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(name)}</title>
<style>
:root{{--bg:#0a0a0c;--panel:#121216;--border:#27272a;--text:#e4e4e7;--accent:#00f0ff}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:var(--bg);color:var(--text);font-family:ui-monospace,'SF Mono',Consolas,monospace;
line-height:1.7;max-width:780px;margin:0 auto;padding:40px 20px}}
h1{{font-size:2.2em;border-bottom:2px solid var(--accent);padding-bottom:10px;margin-bottom:20px;color:var(--accent)}}
h2{{font-size:1.5em;margin:30px 0 14px;color:var(--accent)}}
h3{{font-size:1.2em;margin:24px 0 10px}}
p{{margin-bottom:14px}}
a{{color:var(--accent)}}
code{{background:var(--panel);padding:2px 6px;border-radius:4px;color:var(--accent)}}
pre{{background:var(--panel);padding:16px;border-radius:8px;overflow-x:auto;margin:14px 0}}
pre code{{background:none;padding:0;color:inherit}}
blockquote{{border-left:4px solid var(--accent);padding:10px 18px;margin:18px 0;background:rgba(0,240,255,0.05);border-radius:0 6px 6px 0}}
ul{{padding-left:24px;margin-bottom:14px}}
hr{{border:none;border-top:1px solid var(--border);margin:28px 0}}
.meta{{color:#71717a;font-size:11px;margin-bottom:30px;font-family:ui-monospace,monospace;
border:1px solid var(--border);padding:10px 14px;border-radius:6px;background:var(--panel)}}
</style>
</head>
<body>
<div class="meta">⚛ NEXUS PLASMA STUDIO · {ts} · {words} mots · ~{reading} min de lecture · sha256 {sha256(content)[:12]}</div>
{rendered}
</body>
</html>"""


def slides_export(name: str, content: str) -> str:
    """Split markdown by --- and render as standalone slides HTML."""
    slides = [s.strip() for s in content.split("\n---\n") if s.strip()]
    rendered = [render_markdown_to_html(s) for s in slides]
    body = "\n".join(
        f'<section class="slide" data-i="{i}">{r}</section>'
        for i, r in enumerate(rendered)
    )
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>{html.escape(name)} — Slides</title>
<style>
:root{{--bg:#050505;--panel:#0a0a0c;--border:#27272a;--text:#e4e4e7;--accent:#00f0ff}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;overflow:hidden;height:100vh}}
.slide{{position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;
align-items:center;padding:5vh 8vw;text-align:center}}
.slide.active{{display:flex}}
.slide h1{{font-size:3em;margin-bottom:20px;color:var(--accent);border:none}}
.slide h2{{font-size:2.2em;margin-bottom:20px;color:var(--accent)}}
.slide h3{{font-size:1.6em;margin-bottom:20px;color:var(--accent)}}
.slide p{{font-size:1.4em;margin-bottom:14px}}
.slide code{{background:var(--panel);padding:2px 8px;border-radius:4px;color:var(--accent);font-family:ui-monospace,monospace}}
.slide pre{{background:var(--panel);padding:16px;border-radius:8px;text-align:left;font-size:0.9em;margin:14px 0}}
.slide ul{{font-size:1.3em;text-align:left;padding-left:30px}}
.slide li{{margin-bottom:8px}}
.slide blockquote{{font-size:1.6em;font-style:italic;color:#a1a1aa;border-left:4px solid var(--accent);padding-left:20px}}
.counter{{position:fixed;bottom:20px;right:30px;color:var(--accent);font-family:ui-monospace,monospace;font-size:14px}}
.hint{{position:fixed;bottom:20px;left:30px;color:#71717a;font-family:ui-monospace,monospace;font-size:12px}}
</style>
</head>
<body>
{body}
<div class="counter"><span id="i">1</span> / {len(rendered)}</div>
<div class="hint">← → / Espace / F pour plein écran</div>
<script>
let cur=0;const slides=document.querySelectorAll('.slide');
function show(i){{cur=Math.max(0,Math.min(slides.length-1,i));slides.forEach((s,n)=>s.classList.toggle('active',n===cur));
document.getElementById('i').textContent=cur+1;}}
show(0);
document.addEventListener('keydown',e=>{{
if(e.key==='ArrowRight'||e.key===' ')show(cur+1);
else if(e.key==='ArrowLeft')show(cur-1);
else if(e.key==='f'||e.key==='F'){{if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen();}}
}});
</script>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
# §11 — FILE WATCHER (detect external edits)
# ═══════════════════════════════════════════════════════════════════════════════

class FileWatcher:
    """Polls files in WORKSPACE dir and reports changes (best-effort)."""

    def __init__(self):
        self._snapshot: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._update_snapshot()

    def _update_snapshot(self) -> None:
        snap: Dict[str, float] = {}
        try:
            for f in WORKSPACE.glob("*.md"):
                snap[f.name] = f.stat().st_mtime
        except Exception:
            pass
        with self._lock:
            self._snapshot = snap

    def diff(self) -> Dict:
        """Returns {added: [...], modified: [...], removed: [...]}."""
        prev = dict(self._snapshot)
        new_snap: Dict[str, float] = {}
        try:
            for f in WORKSPACE.glob("*.md"):
                new_snap[f.name] = f.stat().st_mtime
        except Exception:
            pass
        added    = [n for n in new_snap if n not in prev]
        removed  = [n for n in prev if n not in new_snap]
        modified = [n for n in new_snap if n in prev and new_snap[n] != prev[n]]
        with self._lock:
            self._snapshot = new_snap
        return {"added": added, "modified": modified, "removed": removed}

    def start(self, interval: float = 5.0) -> None:
        def loop():
            while True:
                try:
                    time.sleep(interval)
                    d = self.diff()
                    if d["added"] or d["modified"] or d["removed"]:
                        log("INFO", f"watcher: +{d['added']} ~{d['modified']} -{d['removed']}")
                        # Sync to DB
                        for name in d["added"] + d["modified"]:
                            try:
                                content = (WORKSPACE / name).read_text(encoding="utf-8")
                                DB.upsert_file(name, content)
                            except Exception:
                                pass
                        for name in d["removed"]:
                            try:
                                DB.delete_file(name)
                            except Exception:
                                pass
                except Exception as e:
                    log("WARN", f"watcher: {e}")
        t = threading.Thread(target=loop, daemon=True)
        t.start()


WATCHER = FileWatcher()

# ═══════════════════════════════════════════════════════════════════════════════
# §12 — HTML UI (monolithic, embedded)
# ═══════════════════════════════════════════════════════════════════════════════

HTML_UI = r"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>⚛ Plasma Studio · Linus Edition</title>
<script src="https://cdn.jsdelivr.net/npm/marked@11/marked.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}

/* ─── themes ───────────────────────────────────────────────────────────── */
:root, body.theme-cyberpunk{
--bg:#050505;--panel:#0a0a0c;--panel2:#121216;--border:#27272a;
--text:#e4e4e7;--muted:#71717a;--accent:#00f0ff;--accent2:#ff00aa;
--accent-dim:rgba(0,240,255,0.12);
--success:#10b981;--danger:#ef4444;--warn:#f59e0b;
--mono:ui-monospace,'SF Mono','JetBrains Mono',Consolas,monospace;
--ui:'Inter',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
--statusbar:#00f0ff;
}
body.theme-gruvbox{
--bg:#1d2021;--panel:#282828;--panel2:#3c3836;--border:#504945;
--text:#ebdbb2;--muted:#928374;--accent:#fabd2f;--accent2:#fb4934;
--accent-dim:rgba(250,189,47,0.12);
--success:#b8bb26;--danger:#fb4934;--warn:#fe8019;
--statusbar:#fabd2f;
}
body.theme-solarized{
--bg:#002b36;--panel:#073642;--panel2:#134656;--border:#586e75;
--text:#93a1a1;--muted:#657b83;--accent:#2aa198;--accent2:#d33682;
--accent-dim:rgba(42,161,152,0.15);
--success:#859900;--danger:#dc322f;--warn:#b58900;
--statusbar:#2aa198;
}
body.theme-ghost{
--bg:#fafafa;--panel:#fff;--panel2:#f4f4f5;--border:#e4e4e7;
--text:#18181b;--muted:#71717a;--accent:#2563eb;--accent2:#dc2626;
--accent-dim:rgba(37,99,235,0.1);
--success:#16a34a;--danger:#dc2626;--warn:#d97706;
--statusbar:#2563eb;
}

html,body{height:100%;overflow:hidden;background:var(--bg);color:var(--text);
font-family:var(--ui);font-size:14px;-webkit-font-smoothing:antialiased;transition:background .2s}

/* ─── topbar ───────────────────────────────────────────────────────────── */
#topbar{height:54px;background:var(--panel);border-bottom:1px solid var(--border);
display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:100;gap:12px}
#topbar .logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px}
#topbar .logo .dot{width:9px;height:9px;border-radius:50%;background:var(--accent);
box-shadow:0 0 14px var(--accent);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
#topbar .pill{font-family:var(--mono);font-size:10px;padding:3px 9px;border-radius:99px;
background:var(--accent-dim);color:var(--accent);border:1px solid rgba(255,255,255,.1);font-weight:600;letter-spacing:.5px}
#topbar .right{display:flex;gap:6px;align-items:center;flex-wrap:wrap}

/* ─── buttons ──────────────────────────────────────────────────────────── */
.btn{padding:7px 11px;background:var(--panel2);border:1px solid var(--border);color:var(--text);
border-radius:6px;font-size:12px;cursor:pointer;font-family:var(--mono);transition:.12s;
display:flex;align-items:center;gap:6px;white-space:nowrap}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.btn.primary{background:var(--accent);color:var(--bg);border-color:var(--accent);font-weight:700}
.btn.primary:hover{filter:brightness(1.1);color:var(--bg)}
.btn.icon{padding:7px 9px}
.btn.active{background:var(--accent);color:var(--bg);border-color:var(--accent)}
select.theme{padding:5px 8px;background:var(--panel2);border:1px solid var(--border);color:var(--text);
border-radius:6px;font-family:var(--mono);font-size:11px;cursor:pointer;outline:none}
select.theme:focus{border-color:var(--accent)}

/* ─── layout ───────────────────────────────────────────────────────────── */
#layout{display:flex;height:calc(100vh - 54px - 30px)}

/* ─── sidebar ──────────────────────────────────────────────────────────── */
#sidebar{width:260px;background:var(--panel);border-right:1px solid var(--border);
display:flex;flex-direction:column;overflow:hidden}
#sidebar .head{padding:12px 14px;border-bottom:1px solid var(--border)}
#sidebar .title{font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;
text-transform:uppercase;margin-bottom:8px}
#new-file{display:flex;gap:6px}
#new-file input{flex:1;padding:7px 10px;background:var(--panel2);border:1px solid var(--border);
color:var(--text);border-radius:6px;font-size:12px;outline:none;font-family:var(--mono)}
#new-file input:focus{border-color:var(--accent)}
#new-file button{padding:7px 12px;background:var(--accent);color:var(--bg);border:none;
border-radius:6px;font-weight:700;cursor:pointer;font-size:14px}
#new-file button:hover{filter:brightness(1.1)}

#search{width:100%;padding:7px 10px;background:var(--panel2);border:1px solid var(--border);
color:var(--text);border-radius:6px;font-size:12px;margin-top:8px;outline:none;font-family:var(--mono)}
#search:focus{border-color:var(--accent)}

#files{flex:1;overflow-y:auto;padding:8px}
.file{padding:8px 10px;border-radius:6px;cursor:pointer;font-family:var(--mono);font-size:12px;
color:var(--text);display:flex;align-items:center;justify-content:space-between;
margin-bottom:2px;transition:.12s;border:1px solid transparent}
.file:hover{background:var(--panel2)}
.file.active{background:var(--accent-dim);border-color:rgba(255,255,255,.1);color:var(--accent)}
.file .name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file .del{color:var(--muted);background:none;border:none;cursor:pointer;padding:2px 6px;
border-radius:4px;font-size:11px;opacity:0}
.file:hover .del{opacity:1}
.file .del:hover{background:var(--danger);color:#fff}

/* outline panel */
#outline-wrap{padding:10px 14px;border-top:1px solid var(--border);max-height:200px;overflow-y:auto}
#outline-wrap .title{font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;
text-transform:uppercase;margin-bottom:8px}
.outline-item{padding:4px 6px;cursor:pointer;font-size:12px;color:var(--muted);
border-radius:4px;font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.outline-item:hover{color:var(--accent);background:var(--panel2)}
.outline-item.l1{font-weight:700;color:var(--text)}
.outline-item.l2{padding-left:14px}
.outline-item.l3{padding-left:28px}

/* templates */
#templates{padding:10px 14px;border-top:1px solid var(--border)}
#templates .title{font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;
text-transform:uppercase;margin-bottom:8px}
.tpl-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.tpl{padding:7px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;
color:var(--text);font-size:11px;cursor:pointer;text-align:center;font-family:var(--mono);transition:.12s}
.tpl:hover{border-color:var(--accent);color:var(--accent)}

/* ─── main ─────────────────────────────────────────────────────────────── */
#main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
#toolbar{height:46px;background:var(--panel);border-bottom:1px solid var(--border);
display:flex;align-items:center;padding:0 14px;gap:6px;flex-wrap:wrap}
#toolbar .sep{width:1px;height:20px;background:var(--border);margin:0 4px}

#editor-wrap{flex:1;display:flex;overflow:hidden}
.pane{flex:1;display:flex;flex-direction:column;min-width:0}
.pane-head{padding:8px 14px;background:var(--panel2);border-bottom:1px solid var(--border);
font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:1.5px;
text-transform:uppercase;display:flex;justify-content:space-between}
#editor{flex:1;background:var(--bg);color:var(--text);border:none;padding:20px 24px;
font-family:var(--mono);font-size:13px;line-height:1.7;resize:none;outline:none;
width:100%;tab-size:2;overflow-y:auto}
#editor::placeholder{color:#3f3f46}
#editor.vim-mode{caret-color:var(--accent2)}

#preview-wrap{border-left:1px solid var(--border);background:var(--panel);min-width:0}
#preview{flex:1;overflow-y:auto;padding:30px 40px;line-height:1.7;max-width:100%}
#preview h1{font-size:2em;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)}
#preview h2{font-size:1.5em;margin:24px 0 14px;color:var(--accent)}
#preview h3{font-size:1.2em;margin:20px 0 10px}
#preview p{margin-bottom:14px}
#preview a{color:var(--accent);text-decoration:none;border-bottom:1px dotted var(--accent)}
#preview img{max-width:100%;border-radius:8px;border:1px solid var(--border);margin:14px 0}
#preview blockquote{border-left:4px solid var(--accent);background:var(--accent-dim);
padding:14px 18px;margin:18px 0;border-radius:0 8px 8px 0;color:var(--text)}
#preview pre{background:var(--bg);padding:16px;border-radius:8px;border:1px solid var(--border);
overflow-x:auto;margin:16px 0}
#preview code{font-family:var(--mono);font-size:.9em;background:var(--panel2);
padding:2px 6px;border-radius:4px;color:var(--accent)}
#preview pre code{background:none;padding:0;color:inherit}
#preview table{width:100%;border-collapse:collapse;margin:18px 0}
#preview th,#preview td{border:1px solid var(--border);padding:10px;text-align:left}
#preview th{background:var(--panel2);color:var(--accent)}
#preview hr{border:none;height:1px;background:var(--border);margin:28px 0}
#preview ul,#preview ol{padding-left:24px;margin-bottom:14px}

/* ─── statusbar ─────────────────────────────────────────────────────────── */
#statusbar{height:30px;background:var(--statusbar);color:var(--bg);display:flex;
justify-content:space-between;align-items:center;padding:0 14px;
font-family:var(--mono);font-size:11px;font-weight:700}
#statusbar .left,#statusbar .right{display:flex;gap:14px;align-items:center}
#statusbar .vim-flag{background:var(--bg);color:var(--statusbar);padding:2px 8px;
border-radius:4px;font-weight:800;letter-spacing:1px;display:none}
#statusbar .vim-flag.show{display:inline-block;animation:pulse 1s infinite}
#statusbar .dirty{color:var(--bg);font-weight:800}
#statusbar .dirty::before{content:'● '}

/* ─── toasts ───────────────────────────────────────────────────────────── */
#toasts{position:fixed;bottom:50px;right:20px;display:flex;flex-direction:column;
gap:8px;z-index:9999}
.toast{background:var(--panel);padding:12px 18px;border-radius:8px;
border-left:4px solid var(--accent);color:var(--text);box-shadow:0 8px 24px rgba(0,0,0,.6);
font-family:var(--mono);font-size:12px;animation:slideIn .2s ease;max-width:320px}
.toast.err{border-left-color:var(--danger)}
.toast.warn{border-left-color:var(--warn)}
.toast.ok{border-left-color:var(--success)}
@keyframes slideIn{from{transform:translateX(120%)}to{transform:translateX(0)}}

/* ─── scrollbars ───────────────────────────────────────────────────────── */
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:5px}
::-webkit-scrollbar-thumb:hover{background:var(--muted)}

/* ─── modal ─────────────────────────────────────────────────────────────── */
#modal{position:fixed;inset:0;background:rgba(0,0,0,.8);display:none;
align-items:center;justify-content:center;z-index:5000;backdrop-filter:blur(4px)}
#modal.show{display:flex}
.modal-box{background:var(--panel);border:1px solid var(--border);border-radius:12px;
padding:24px;max-width:560px;width:90%;max-height:80vh;overflow-y:auto}
.modal-box h3{color:var(--accent);margin-bottom:16px;font-size:16px;display:flex;justify-content:space-between;align-items:center}
.modal-box .field{margin-bottom:14px}
.modal-box label{display:block;font-size:10px;color:var(--muted);letter-spacing:1.5px;
text-transform:uppercase;margin-bottom:6px;font-weight:700}
.modal-box input,.modal-box textarea,.modal-box select{width:100%;padding:10px;background:var(--panel2);
border:1px solid var(--border);color:var(--text);border-radius:6px;font-family:var(--mono);
font-size:13px;outline:none}
.modal-box input:focus,.modal-box textarea:focus{border-color:var(--accent)}
.modal-box .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.modal-actions{display:flex;gap:8px;margin-top:16px}
.modal-actions .btn{flex:1;justify-content:center;padding:12px}
.stat-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);
font-family:var(--mono);font-size:12px}
.stat-row .k{color:var(--muted)}
.stat-row .v{color:var(--accent);font-weight:700}
.bar{height:8px;background:var(--panel2);border-radius:4px;overflow:hidden;margin:4px 0 12px}
.bar>div{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .3s}
.diff-line{padding:2px 8px;font-family:var(--mono);font-size:12px;white-space:pre;overflow-x:auto}
.diff-line.add{background:rgba(16,185,129,.15);color:var(--success)}
.diff-line.del{background:rgba(239,68,68,.15);color:var(--danger)}
.diff-line.ctx{color:var(--muted)}
kbd{background:var(--panel2);border:1px solid var(--border);border-radius:4px;
padding:1px 6px;font-family:var(--mono);font-size:11px;color:var(--accent)}
.help-grid{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:12px;
font-family:var(--mono);color:var(--muted)}
.help-grid div{padding:2px 0}

/* ─── vim cmd line ─────────────────────────────────────────────────────── */
#vim-cmd{position:absolute;bottom:30px;left:0;right:0;background:var(--panel);
border-top:1px solid var(--border);padding:6px 14px;display:none;font-family:var(--mono);
font-size:13px;color:var(--text);z-index:50}
#vim-cmd.show{display:flex;align-items:center;gap:6px}
#vim-cmd .prompt{color:var(--accent2);font-weight:700}
#vim-cmd input{flex:1;background:none;border:none;color:var(--text);outline:none;
font-family:var(--mono);font-size:13px}
</style>
</head>
<body class="theme-cyberpunk">

<div id="topbar">
  <div class="logo">
    <div class="dot"></div>
    <span>⚛ PLASMA STUDIO</span>
    <span class="pill">LINUS EDITION v3.0</span>
  </div>
  <div class="right">
    <select class="theme" id="theme-select" title="Thème" onchange="setTheme(this.value)">
      <option value="cyberpunk">Cyberpunk</option>
      <option value="gruvox">Gruvbox</option>
      <option value="solarized">Solarized</option>
      <option value="ghost">Ghost</option>
    </select>
    <button class="btn icon" title="Vim mode (Ctrl+V)" id="vim-btn" onclick="toggleVim()">⌨ VIM</button>
    <button class="btn icon" title="Find & replace (Ctrl+F)" onclick="openFindReplace()">🔍</button>
    <button class="btn icon" title="Outline" onclick="scrollToOutline()">≡</button>
    <button class="btn" onclick="openCalc()">🧮 Calc</button>
    <button class="btn" onclick="openStats()">📊 Stats</button>
    <button class="btn" onclick="openSys()">🖥️ Sys</button>
    <button class="btn" onclick="openBench()">⚡ Bench</button>
    <button class="btn" onclick="openBackups()">💾 Backups</button>
    <button class="btn" onclick="openHelp()">❔</button>
    <button class="btn primary" onclick="exportFile()">⬇ Export</button>
  </div>
</div>

<div id="layout">
  <div id="sidebar">
    <div class="head">
      <div class="title">Fichiers</div>
      <div id="new-file">
        <input id="new-name" placeholder="fichier.md" onkeypress="if(event.key==='Enter')createFile()">
        <button onclick="createFile()">+</button>
      </div>
      <input id="search" placeholder="🔎 Rechercher..." oninput="filterFiles(this.value)">
    </div>
    <div id="files"></div>
    <div id="outline-wrap">
      <div class="title">Plan</div>
      <div id="outline"></div>
    </div>
    <div id="templates">
      <div class="title">Templates</div>
      <div class="tpl-grid">
        <div class="tpl" onclick="applyTemplate('readme')">README</div>
        <div class="tpl" onclick="applyTemplate('blog')">Blog</div>
        <div class="tpl" onclick="applyTemplate('documentation')">Docs</div>
        <div class="tpl" onclick="applyTemplate('notes')">Notes</div>
        <div class="tpl" onclick="applyTemplate('math')">Math</div>
        <div class="tpl" onclick="applyTemplate('code')">Code</div>
      </div>
    </div>
  </div>

  <div id="main">
    <div id="toolbar">
      <button class="btn" onclick="fmt('bold')" title="Bold (Ctrl+B)"><b>B</b></button>
      <button class="btn" onclick="fmt('italic')" title="Italic (Ctrl+I)"><i>I</i></button>
      <button class="btn" onclick="fmt('code')" title="Inline code">&lt;/&gt;</button>
      <button class="btn" onclick="fmt('link')" title="Lien">🔗</button>
      <span class="sep"></span>
      <button class="btn" onclick="fmt('h1')">H1</button>
      <button class="btn" onclick="fmt('h2')">H2</button>
      <button class="btn" onclick="fmt('h3')">H3</button>
      <span class="sep"></span>
      <button class="btn" onclick="fmt('ul')">• Liste</button>
      <button class="btn" onclick="fmt('quote')">❝</button>
      <button class="btn" onclick="fmt('hr')">―</button>
      <button class="btn" onclick="fmt('table')">▦</button>
      <span class="sep"></span>
      <button class="btn" onclick="fmt('slide')">📹 Slide</button>
      <div style="flex:1"></div>
      <button class="btn" onclick="openDiff()">📜 Diff</button>
      <button class="btn" onclick="openSlides()">🎬 Slides</button>
      <button class="btn" onclick="backupCurrent()">💾 Backup</button>
      <button class="btn primary" onclick="saveCurrent()" title="Ctrl+S">💾 Save</button>
    </div>

    <div id="editor-wrap" style="position:relative">
      <div class="pane">
        <div class="pane-head">
          <span id="editor-title">Aucun fichier</span>
          <span id="cursor-pos">L1 C1</span>
        </div>
        <textarea id="editor" placeholder="# Nouveau document&#10;&#10;Commence à écrire...&#10;&#10;Math: $$f(x)=\int e^{-x^2}dx$$&#10;&#10;Slides: sépare par --- sur une ligne vide"></textarea>
      </div>
      <div class="pane" id="preview-wrap">
        <div class="pane-head">
          <span>Preview</span>
          <span id="preview-stats"></span>
        </div>
        <div id="preview"></div>
      </div>
      <div id="vim-cmd">
        <span class="prompt" id="vim-prompt">:</span>
        <input id="vim-input" autocomplete="off" onkeydown="handleVimCmd(event)">
      </div>
    </div>
  </div>
</div>

<div id="statusbar">
  <div class="left">
    <span id="status-file">Prêt</span>
    <span id="dirty-flag" class="dirty" style="display:none">non sauvegardé</span>
    <span>UTF-8</span>
    <span>Markdown</span>
    <span class="vim-flag" id="vim-flag">VIM</span>
  </div>
  <div class="right">
    <span id="status-words">0 mots</span>
    <span id="status-read">0 min</span>
    <span id="status-size">0 B</span>
    <span id="status-hash">—</span>
  </div>
</div>

<div id="toasts"></div>
<div id="modal"><div class="modal-box" id="modal-content"></div></div>

<script>
// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════
let currentFile = null;
let allFiles = [];
let isDirty = false;
let vimMode = false;
let vimSubMode = null; // 'normal' | 'insert'
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
let saveTimer = null;

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════
function toast(msg, type='ok'){
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
function fmtSize(n){
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/1024/1024).toFixed(1) + ' MB';
}
function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}
function setDirty(v){
  isDirty = v;
  document.getElementById('dirty-flag').style.display = v ? 'inline' : 'none';
}
function setTheme(t){
  document.body.className = 'theme-' + t;
  document.getElementById('theme-select').value = t === 'gruvox' ? 'gruvox' : t;
  try { localStorage.setItem('plasma-theme', t); } catch(e) {}
}
function loadTheme(){
  try {
    const t = localStorage.getItem('plasma-theme') || 'cyberpunk';
    setTheme(t);
  } catch(e) { setTheme('cyberpunk'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════════════════
marked.setOptions({ gfm: true, breaks: true });

function render(){
  const text = editor.value;
  preview.innerHTML = marked.parse(text);
  if (typeof renderMathInElement !== 'undefined'){
    renderMathInElement(preview, {
      delimiters: [
        {left:'$$', right:'$$', display:true},
        {left:'$', right:'$', display:false},
        {left:'\\[', right:'\\]', display:true},
        {left:'\\(', right:'\\)', display:false}
      ],
      throwOnError: false
    });
  }
  if (typeof hljs !== 'undefined'){
    document.querySelectorAll('#preview pre code').forEach(b => {
      try { hljs.highlightElement(b); } catch(e) {}
    });
  }
  updateStats(text);
  updateOutline(text);
  updateCursorPos();
}

function updateStats(text){
  const bytes = new Blob([text]).size;
  const words = (text.match(/\b\w+\b/g) || []).length;
  const reading = Math.max(1, Math.round(words / 200));
  document.getElementById('status-size').textContent = fmtSize(bytes);
  document.getElementById('status-words').textContent = words + ' mots';
  document.getElementById('status-read').textContent = '~' + reading + ' min';
  document.getElementById('preview-stats').textContent = text.length + ' chars · ' + words + ' mots';
}

function updateOutline(text){
  const lines = text.split('\n');
  const items = [];
  let inCode = false;
  lines.forEach(line => {
    const s = line.trim();
    if (s.startsWith('```')) { inCode = !inCode; return; }
    if (inCode) return;
    const m = s.match(/^(#{1,3})\s+(.+)/);
    if (m){
      const level = m[1].length;
      const title = m[2].replace(/#+$/, '').trim();
      const lineIdx = lines.indexOf(line);
      items.push({ level, title, line: lineIdx });
    }
  });
  const el = document.getElementById('outline');
  if (items.length === 0){
    el.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:4px 6px">Aucun titre</div>';
    return;
  }
  el.innerHTML = items.map(i =>
    `<div class="outline-item l${i.level}" onclick="scrollEditorToLine(${i.line})" title="${escapeHtml(i.title)}">${escapeHtml(i.title)}</div>`
  ).join('');
}

function scrollEditorToLine(line){
  const target = editor.value.split('\n').slice(0, line).join('\n').length;
  editor.focus();
  editor.setSelectionRange(target, target);
  editor.scrollTop = editor.scrollHeight * (line / editor.value.split('\n').length);
  // Also scroll preview to matching heading
  const headings = preview.querySelectorAll('h1, h2, h3');
  if (headings[line]) headings[line].scrollIntoView({behavior:'smooth', block:'start'});
}

editor.addEventListener('input', () => {
  setDirty(true);
  render();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (isDirty) saveCurrent(); }, 3000);
});

editor.addEventListener('keyup', updateCursorPos);
editor.addEventListener('click', updateCursorPos);

function updateCursorPos(){
  if (vimMode) return; // vim manages its own cursor display
  const pos = editor.selectionStart;
  const before = editor.value.substring(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  document.getElementById('cursor-pos').textContent = `L${line} C${col}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════════════════════
async function api(path, opts={}){
  const r = await fetch('/api' + path, opts);
  return r.json();
}

async function loadFiles(){
  try {
    allFiles = await api('/files');
    renderFileList(allFiles);
  } catch(e){
    toast('Erreur chargement', 'err');
  }
}

function renderFileList(files){
  const el = document.getElementById('files');
  el.innerHTML = '';
  if (files.length === 0){
    el.innerHTML = '<div style="padding:20px;color:var(--muted);text-align:center;font-size:12px">Aucun fichier.<br>Crée-en un.</div>';
    return;
  }
  files.forEach(f => {
    const d = document.createElement('div');
    d.className = 'file' + (currentFile === f.name ? ' active' : '');
    d.innerHTML = `
      <span class="name">${escapeHtml(f.name)}</span>
      <button class="del" onclick="event.stopPropagation();deleteFile('${escapeHtml(f.name)}')">✕</button>`;
    d.onclick = () => loadFile(f.name);
    el.appendChild(d);
  });
}

function filterFiles(q){
  q = q.toLowerCase().trim();
  if (!q){ renderFileList(allFiles); return; }
  const filtered = allFiles.filter(f => f.name.toLowerCase().includes(q));
  renderFileList(filtered);
}

async function loadFile(name){
  try {
    const d = await api('/load/' + encodeURIComponent(name));
    if (d.error){ toast(d.error, 'err'); return; }
    editor.value = d.content;
    currentFile = name;
    setDirty(false);
    document.getElementById('editor-title').textContent = name;
    document.getElementById('status-file').textContent = name;
    document.getElementById('status-hash').textContent = (d.hash || '').substring(0, 8);
    render();
    loadFiles();
    toast('Chargé : ' + name);
  } catch(e){
    toast('Erreur lecture', 'err');
  }
}

async function saveCurrent(){
  if (!currentFile){
    const n = prompt('Nom du fichier:', 'sans-titre.md');
    if (!n) return;
    currentFile = n;
    document.getElementById('editor-title').textContent = n;
    document.getElementById('status-file').textContent = n;
  }
  try {
    const d = await api('/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name: currentFile, content: editor.value })
    });
    if (d.error){ toast(d.error, 'err'); return; }
    setDirty(false);
    document.getElementById('status-hash').textContent = (d.hash || '').substring(0, 8);
    toast('Sauvegardé · ' + (d.words || 0) + ' mots');
    loadFiles();
  } catch(e){
    toast('Erreur save', 'err');
  }
}

async function createFile(){
  const input = document.getElementById('new-name');
  let name = input.value.trim();
  if (!name){ toast('Nom requis', 'warn'); return; }
  try {
    const d = await api('/create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name })
    });
    if (d.error){ toast(d.error, 'err'); return; }
    input.value = '';
    await loadFiles();
    loadFile(d.name);
  } catch(e){
    toast('Erreur création', 'err');
  }
}

async function deleteFile(name){
  if (!confirm('Supprimer ' + name + ' ?')) return;
  try {
    await api('/delete', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name })
    });
    if (currentFile === name){
      currentFile = null;
      editor.value = '';
      document.getElementById('editor-title').textContent = 'Aucun fichier';
      render();
    }
    loadFiles();
    toast('Supprimé');
  } catch(e){
    toast('Erreur suppression', 'err');
  }
}

async function backupCurrent(){
  if (!currentFile){ toast('Aucun fichier', 'warn'); return; }
  try {
    const d = await api('/backup', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name: currentFile, content: editor.value })
    });
    toast('Backup : ' + d.file);
  } catch(e){
    toast('Erreur backup', 'err');
  }
}

async function exportFile(){
  if (!currentFile){ toast('Aucun fichier', 'warn'); return; }
  try {
    const d = await api('/export', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name: currentFile })
    });
    if (d.error){ toast(d.error, 'err'); return; }
    toast('Exporté : ' + d.path);
  } catch(e){
    toast('Erreur export', 'err');
  }
}

function applyTemplate(key){
  const tpl = window.TEMPLATES[key];
  if (!tpl){ toast('Template absent', 'err'); return; }
  editor.value = tpl.replace('{date}', new Date().toISOString().substring(0,10));
  setDirty(true);
  render();
  toast('Template appliqué');
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════════════
function insertAtCursor(text){
  const s = editor.selectionStart, e = editor.selectionEnd;
  editor.value = editor.value.substring(0, s) + text + editor.value.substring(e);
  editor.selectionStart = editor.selectionEnd = s + text.length;
  editor.focus();
  setDirty(true);
  render();
}

function fmt(type){
  const s = editor.selectionStart, e = editor.selectionEnd;
  const sel = editor.value.substring(s, e);
  if (type === 'bold')      insertAtCursor(`**${sel || 'texte'}**`);
  else if (type === 'italic')insertAtCursor(`*${sel || 'texte'}*`);
  else if (type === 'code')  insertAtCursor('`' + (sel || 'code') + '`');
  else if (type === 'link')  insertAtCursor(`[${sel || 'lien'}](url)`);
  else if (type === 'h1')    insertAtCursor(`\n# ${sel || 'Titre'}\n`);
  else if (type === 'h2')    insertAtCursor(`\n## ${sel || 'Titre'}\n`);
  else if (type === 'h3')    insertAtCursor(`\n### ${sel || 'Titre'}\n`);
  else if (type === 'ul')    insertAtCursor(`\n- ${sel || 'Item'}\n`);
  else if (type === 'quote') insertAtCursor(`\n> ${sel || 'Citation'}\n`);
  else if (type === 'hr')    insertAtCursor(`\n\n---\n\n`);
  else if (type === 'slide') insertAtCursor(`\n\n---\n\n`);
  else if (type === 'table') insertAtCursor(`\n| Col1 | Col2 | Col3 |\n|------|------|------|\n| a | b | c |\n| d | e | f |\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// VIM MODE (simplified)
// ═══════════════════════════════════════════════════════════════════════════
function toggleVim(){
  vimMode = !vimMode;
  document.getElementById('vim-btn').classList.toggle('active', vimMode);
  document.getElementById('vim-flag').classList.toggle('show', vimMode);
  editor.classList.toggle('vim-mode', vimMode);
  if (vimMode){
    vimSubMode = 'normal';
    editor.value = editor.value; // no-op
    toast('VIM mode activé · i pour insérer · Échap pour normal · :w :q');
    document.getElementById('cursor-pos').textContent = '— NORMAL —';
    // Prevent default typing in normal mode
    editor.addEventListener('keydown', vimKeydown);
  } else {
    editor.removeEventListener('keydown', vimKeydown);
    document.getElementById('vim-cmd').classList.remove('show');
    updateCursorPos();
    toast('VIM mode désactivé');
  }
}

function vimKeydown(e){
  if (vimSubMode === 'insert'){
    if (e.key === 'Escape'){
      e.preventDefault();
      vimSubMode = 'normal';
      document.getElementById('cursor-pos').textContent = '— NORMAL —';
    }
    return;
  }
  // Normal mode — block default
  e.preventDefault();
  const k = e.key;
  if (k === 'i'){
    vimSubMode = 'insert';
    document.getElementById('cursor-pos').textContent = '— INSERT —';
  } else if (k === 'a'){
    const p = editor.selectionStart;
    editor.setSelectionRange(p + 1, p + 1);
    vimSubMode = 'insert';
    document.getElementById('cursor-pos').textContent = '— INSERT —';
  } else if (k === 'o'){
    insertAtCursor('\n');
    vimSubMode = 'insert';
    document.getElementById('cursor-pos').textContent = '— INSERT —';
  } else if (k === 'O'){
    const p = editor.selectionStart;
    const before = editor.value.substring(0, p);
    const lineStart = before.lastIndexOf('\n') + 1;
    editor.value = editor.value.substring(0, lineStart) + '\n' + editor.value.substring(lineStart);
    editor.setSelectionRange(lineStart, lineStart);
    setDirty(true); render();
    vimSubMode = 'insert';
    document.getElementById('cursor-pos').textContent = '— INSERT —';
  } else if (k === 'h'){
    const p = editor.selectionStart;
    editor.setSelectionRange(Math.max(0, p - 1), Math.max(0, p - 1));
  } else if (k === 'l'){
    const p = editor.selectionStart;
    editor.setSelectionRange(Math.min(editor.value.length, p + 1), Math.min(editor.value.length, p + 1));
  } else if (k === 'j'){
    moveCursorLine(1);
  } else if (k === 'k'){
    moveCursorLine(-1);
  } else if (k === 'x'){
    const p = editor.selectionStart;
    if (p < editor.value.length){
      editor.value = editor.value.substring(0, p) + editor.value.substring(p + 1);
      editor.setSelectionRange(p, p);
      setDirty(true); render();
    }
  } else if (k === 'd'){
    // dd - delete line
    const p = editor.selectionStart;
    const v = editor.value;
    const before = v.substring(0, p);
    const lineStart = before.lastIndexOf('\n') + 1;
    const nextNL = v.indexOf('\n', p);
    const lineEnd = nextNL === -1 ? v.length : nextNL;
    const removed = v.substring(lineStart, lineEnd + 1);
    editor.value = v.substring(0, lineStart) + v.substring(lineEnd + 1);
    editor.setSelectionRange(lineStart, lineStart);
    editor._vimReg = removed;
    setDirty(true); render();
    toast('dd : ligne supprimée');
  } else if (k === 'y'){
    // yy - yank line
    const p = editor.selectionStart;
    const v = editor.value;
    const before = v.substring(0, p);
    const lineStart = before.lastIndexOf('\n') + 1;
    const nextNL = v.indexOf('\n', p);
    const lineEnd = nextNL === -1 ? v.length : nextNL;
    editor._vimReg = v.substring(lineStart, lineEnd + 1);
    toast('yy : ligne copiée');
  } else if (k === 'p'){
    // paste below
    if (editor._vimReg){
      const p = editor.selectionStart;
      const v = editor.value;
      const before = v.substring(0, p);
      const lineEnd = v.indexOf('\n', p);
      const at = lineEnd === -1 ? v.length : lineEnd + 1;
      editor.value = v.substring(0, at) + editor._vimReg + v.substring(at);
      editor.setSelectionRange(at + editor._vimReg.length, at + editor._vimReg.length);
      setDirty(true); render();
    }
  } else if (k === ':'){
    // Open command line
    const cmd = document.getElementById('vim-cmd');
    cmd.classList.add('show');
    const input = document.getElementById('vim-input');
    input.value = '';
    setTimeout(() => input.focus(), 0);
  } else if (k === '/'){
    openFindReplace();
  } else if (k === '$'){
    const p = editor.selectionStart;
    const nextNL = editor.value.indexOf('\n', p);
    const end = nextNL === -1 ? editor.value.length : nextNL;
    editor.setSelectionRange(end, end);
  } else if (k === '0'){
    const p = editor.selectionStart;
    const before = editor.value.substring(0, p);
    const lineStart = before.lastIndexOf('\n') + 1;
    editor.setSelectionRange(lineStart, lineStart);
  } else if (k === 'G'){
    editor.setSelectionRange(editor.value.length, editor.value.length);
    editor.scrollTop = editor.scrollHeight;
  } else if (k === 'g'){
    editor.setSelectionRange(0, 0);
    editor.scrollTop = 0;
  }
}

function moveCursorLine(delta){
  const p = editor.selectionStart;
  const v = editor.value;
  const before = v.substring(0, p);
  const col = p - (before.lastIndexOf('\n') + 1);
  // find target line
  let lineStart = before.lastIndexOf('\n') + 1;
  if (delta > 0){
    const nextNL = v.indexOf('\n', p);
    if (nextNL === -1) return;
    const targetStart = nextNL + 1;
    const targetEnd = v.indexOf('\n', targetStart);
    const targetLen = (targetEnd === -1 ? v.length : targetEnd) - targetStart;
    editor.setSelectionRange(targetStart + Math.min(col, targetLen), targetStart + Math.min(col, targetLen));
  } else {
    const prevNL = before.lastIndexOf('\n', p - 1);
    if (prevNL === -1) return;
    const targetStart = before.lastIndexOf('\n', prevNL - 1) + 1;
    const targetEnd = prevNL;
    const targetLen = targetEnd - targetStart;
    editor.setSelectionRange(targetStart + Math.min(col, targetLen), targetStart + Math.min(col, targetLen));
  }
}

function handleVimCmd(e){
  if (e.key !== 'Enter') return;
  const input = document.getElementById('vim-input');
  const cmd = input.value.trim();
  document.getElementById('vim-cmd').classList.remove('show');
  editor.focus();
  if (cmd === 'w' || cmd === 'write'){
    saveCurrent();
  } else if (cmd === 'q' || cmd === 'quit'){
    if (isDirty && !confirm('Fichier non sauvegardé. Quitter ?')) return;
    currentFile = null;
    editor.value = '';
    document.getElementById('editor-title').textContent = 'Aucun fichier';
    setDirty(false);
    render();
  } else if (cmd === 'x' || cmd === 'wq'){
    saveCurrent().then(() => {
      currentFile = null;
      editor.value = '';
      document.getElementById('editor-title').textContent = 'Aucun fichier';
      setDirty(false);
      render();
    });
  } else if (cmd === 'h' || cmd === 'help'){
    openHelp();
  } else if (cmd.startsWith('!')){
    // shell — blocked
    toast('Shell désactivé (sécurité)', 'warn');
  } else {
    toast('Commande inconnue: :' + cmd, 'warn');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════
function closeModal(){
  document.getElementById('modal').classList.remove('show');
}
document.getElementById('modal').addEventListener('click', e => {
  if (e.target.id === 'modal') closeModal();
});

function openCalc(){
  const c = document.getElementById('modal-content');
  c.innerHTML = `
    <h3>🧮 Calculatrice (AST whitelist) <button class="btn" onclick="closeModal()">×</button></h3>
    <div class="field">
      <label>Expression (sin, cos, sqrt, pi, e, +, -, *, /, ^, %)</label>
      <input id="calc-input" placeholder="sqrt(2) * pi" autofocus>
    </div>
    <div class="field">
      <label>Résultat</label>
      <input id="calc-result" readonly style="color:var(--accent);font-weight:700">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Fermer</button>
      <button class="btn primary" onclick="evalCalc()">Calculer</button>
    </div>`;
  document.getElementById('modal').classList.add('show');
  document.getElementById('calc-input').focus();
  document.getElementById('calc-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') evalCalc();
  });
}

async function evalCalc(){
  const expr = document.getElementById('calc-input').value.trim();
  if (!expr) return;
  try {
    const d = await api('/calc', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ expr })
    });
    document.getElementById('calc-result').value = d.ok ? d.result : 'Erreur: ' + d.error;
  } catch(e){
    document.getElementById('calc-result').value = 'Erreur réseau';
  }
}

async function openStats(){
  try {
    const d = await api('/stats');
    const hist = await api('/history?limit=20');
    const c = document.getElementById('modal-content');
    c.innerHTML = `
      <h3>📊 Statistiques <button class="btn" onclick="closeModal()">×</button></h3>
      <div class="grid2">
        <div><div class="stat-row"><span class="k">Version</span><span class="v">${d.version}</span></div></div>
        <div><div class="stat-row"><span class="k">Codename</span><span class="v">${d.codename}</span></div></div>
        <div><div class="stat-row"><span class="k">Fichiers</span><span class="v">${d.files_count}</span></div></div>
        <div><div class="stat-row"><span class="k">Backups</span><span class="v">${d.backups_count}</span></div></div>
        <div><div class="stat-row"><span class="k">Uptime</span><span class="v">${d.uptime_s.toFixed(1)}s</span></div></div>
        <div><div class="stat-row"><span class="k">Git</span><span class="v">${d.git_enabled ? 'oui' : 'non'}</span></div></div>
        <div><div class="stat-row"><span class="k">Rust</span><span class="v">${d.rust_available ? 'oui' : 'non'}</span></div></div>
        <div><div class="stat-row"><span class="k">Threads</span><span class="v">${d.threads}</span></div></div>
      </div>
      <div class="field" style="margin-top:14px">
        <label>Historique (20 dernières opérations)</label>
        <textarea readonly style="height:200px;font-size:11px">${escapeHtml(hist.map(h => h.timestamp.substring(0,16) + ' · ' + h.action + ' · ' + h.file_name).join('\\n'))}</textarea>
      </div>
      <div class="modal-actions"><button class="btn" onclick="closeModal()">Fermer</button></div>`;
    document.getElementById('modal').classList.add('show');
  } catch(e){
    toast('Erreur stats', 'err');
  }
}

async function openSys(){
  try {
    const d = await api('/sys');
    const c = document.getElementById('modal-content');
    const memBar = `<div class="bar"><div style="width:${d.mem_pct}%"></div></div>`;
    const diskBar = `<div class="bar"><div style="width:${d.disk_pct}%"></div></div>`;
    c.innerHTML = `
      <h3>🖥️ Système <button class="btn" onclick="closeModal()">×</button></h3>
      <div class="stat-row"><span class="k">Hostname</span><span class="v">${escapeHtml(d.hostname)}</span></div>
      <div class="stat-row"><span class="k">Platform</span><span class="v">${escapeHtml(d.platform)}</span></div>
      <div class="stat-row"><span class="k">Python</span><span class="v">${escapeHtml(d.python)}</span></div>
      <div class="stat-row"><span class="k">CPU</span><span class="v">${d.cpu_count} cœurs</span></div>
      <div class="stat-row"><span class="k">Load</span><span class="v">${d.load.join(' / ')}</span></div>
      <div class="stat-row"><span class="k">Mémoire</span><span class="v">${fmtSize(d.mem_used)} / ${fmtSize(d.mem_total)} (${d.mem_pct}%)</span></div>
      ${memBar}
      <div class="stat-row"><span class="k">Disque</span><span class="v">${fmtSize(d.disk_total - d.disk_free)} / ${fmtSize(d.disk_total)} (${d.disk_pct}%)</span></div>
      ${diskBar}
      <div class="stat-row"><span class="k">Threads</span><span class="v">${d.threads}</span></div>
      <div class="stat-row"><span class="k">PID</span><span class="v">${d.pid}</span></div>
      <div class="modal-actions"><button class="btn" onclick="closeModal()">Fermer</button></div>`;
    document.getElementById('modal').classList.add('show');
  } catch(e){
    toast('Erreur sys', 'err');
  }
}

async function openBench(){
  try {
    toast('Bench en cours...', 'warn');
    const d = await api('/bench?n=35');
    const c = document.getElementById('modal-content');
    let rustLine = '';
    if (d.rust_available && d.rust_ms !== undefined){
      rustLine = `
        <div class="stat-row"><span class="k">Rust fib(${d.n})</span><span class="v">${d.rust_result} en ${d.rust_ms} ms</span></div>
        <div class="stat-row"><span class="k">Speedup</span><span class="v">×${d.speedup}</span></div>`;
    } else if (d.rust_available === false){
      rustLine = `<div class="stat-row"><span class="k">Rust</span><span class="v">non disponible (installe rustc)</span></div>`;
    } else if (d.rust_error){
      rustLine = `<div class="stat-row"><span class="k">Rust</span><span class="v">erreur: ${escapeHtml(d.rust_error)}</span></div>`;
    }
    c.innerHTML = `
      <h3>⚡ Bench Rust vs Python <button class="btn" onclick="closeModal()">×</button></h3>
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px">fibonacci(${d.n}) en itératif — bench rapide pour comparer.</p>
      <div class="stat-row"><span class="k">Python fib(${d.n})</span><span class="v">${d.py_result} en ${d.py_ms} ms</span></div>
      ${rustLine}
      <div class="modal-actions"><button class="btn" onclick="closeModal()">Fermer</button></div>`;
    document.getElementById('modal').classList.add('show');
  } catch(e){
    toast('Erreur bench', 'err');
  }
}

async function openBackups(){
  if (!currentFile){ toast('Aucun fichier actif', 'warn'); return; }
  try {
    const d = await api('/backups?name=' + encodeURIComponent(currentFile));
    const c = document.getElementById('modal-content');
    if (!d.length){
      c.innerHTML = `<h3>💾 Backups <button class="btn" onclick="closeModal()">×</button></h3>
        <p style="color:var(--muted)">Aucun backup pour ${escapeHtml(currentFile)}.</p>
        <div class="modal-actions"><button class="btn" onclick="closeModal()">Fermer</button></div>`;
    } else {
      c.innerHTML = `<h3>💾 Backups — ${escapeHtml(currentFile)} <button class="btn" onclick="closeModal()">×</button></h3>
        ${d.map(b => `<div class="stat-row">
          <span class="k">${escapeHtml(b.name)} · ${fmtSize(b.size)} · ${b.date.substring(0,16)}</span>
          <span class="v"><button class="btn" onclick="restoreBackup('${escapeHtml(b.name)}')">Restaurer</button></span>
        </div>`).join('')}
        <div class="modal-actions"><button class="btn" onclick="closeModal()">Fermer</button></div>`;
    }
    document.getElementById('modal').classList.add('show');
  } catch(e){
    toast('Erreur backups', 'err');
  }
}

async function restoreBackup(backupName){
  if (!confirm('Restaurer ' + backupName + ' ? Cela écrasera le contenu actuel.')) return;
  try {
    const d = await api('/restore', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ backup: backupName, original: currentFile })
    });
    if (d.error){ toast(d.error, 'err'); return; }
    await loadFile(currentFile);
    closeModal();
    toast('Restauré depuis ' + backupName);
  } catch(e){
    toast('Erreur restauration', 'err');
  }
}

async function openDiff(){
  if (!currentFile){ toast('Aucun fichier actif', 'warn'); return; }
  try {
    const d = await api('/diff?name=' + encodeURIComponent(currentFile));
    const c = document.getElementById('modal-content');
    if (!d.lines || d.lines.length === 0){
      c.innerHTML = `<h3>📜 Diff <button class="btn" onclick="closeModal()">×</button></h3>
        <p style="color:var(--muted)">Aucune différence avec le dernier backup.</p>`;
    } else {
      const html = d.lines.map(l => {
        const cls = l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : 'ctx';
        return `<div class="diff-line ${cls}">${escapeHtml(l)}</div>`;
      }).join('');
      c.innerHTML = `<h3>📜 Diff — ${escapeHtml(currentFile)} <button class="btn" onclick="closeModal()">×</button></h3>
        <div style="background:var(--bg);border-radius:8px;padding:8px;max-height:400px;overflow-y:auto">${html}</div>`;
    }
    document.getElementById('modal').classList.add('show');
  } catch(e){
    toast('Erreur diff', 'err');
  }
}

function openFindReplace(){
  const c = document.getElementById('modal-content');
  c.innerHTML = `
    <h3>🔍 Find & Replace <button class="btn" onclick="closeModal()">×</button></h3>
    <div class="field">
      <label>Rechercher (regex supportée)</label>
      <input id="fr-find" placeholder="mot ou regex">
    </div>
    <div class="field">
      <label>Remplacer par</label>
      <input id="fr-replace" placeholder="remplacement">
    </div>
    <div class="field">
      <label>Options</label>
      <label style="display:flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;font-size:13px;color:var(--text)">
        <input type="checkbox" id="fr-regex" style="width:auto"> Regex
        <input type="checkbox" id="fr-ci" style="width:auto;margin-left:14px"> Insensible à la casse
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Fermer</button>
      <button class="btn" onclick="frReplace(false)">Remplacer 1</button>
      <button class="btn primary" onclick="frReplace(true)">Tout remplacer</button>
    </div>`;
  document.getElementById('modal').classList.add('show');
  document.getElementById('fr-find').focus();
}

function frReplace(all){
  const findVal = document.getElementById('fr-find').value;
  const repVal = document.getElementById('fr-replace').value;
  const isRegex = document.getElementById('fr-regex').checked;
  const ci = document.getElementById('fr-ci').checked;
  if (!findVal){ toast('Saisis un motif', 'warn'); return; }
  let flags = 'g' + (ci ? 'i' : '');
  let pattern;
  try {
    pattern = isRegex ? new RegExp(findVal, flags) : new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch(e){
    toast('Regex invalide: ' + e.message, 'err');
    return;
  }
  const text = editor.value;
  const matches = text.match(pattern);
  if (!matches){
    toast('Aucune correspondance', 'warn');
    return;
  }
  if (all){
    editor.value = text.replace(pattern, repVal);
    setDirty(true); render();
    toast(matches.length + ' remplacement(s)');
  } else {
    const idx = text.search(pattern);
    if (idx === -1) return;
    editor.value = text.substring(0, idx) + repVal + text.substring(idx + matches[0].length);
    editor.setSelectionRange(idx, idx + repVal.length);
    setDirty(true); render();
    toast('1 remplacement');
  }
}

function openSlides(){
  if (!currentFile){ toast('Aucun fichier actif', 'warn'); return; }
  saveCurrent().then(() => {
    window.open('/slides/' + encodeURIComponent(currentFile), '_blank');
  });
}

function openHelp(){
  const c = document.getElementById('modal-content');
  c.innerHTML = `
    <h3>❔ Aide & Raccourcis <button class="btn" onclick="closeModal()">×</button></h3>
    <div class="help-grid">
      <div><kbd>Ctrl+S</kbd></div><div>Sauvegarder</div>
      <div><kbd>Ctrl+B</kbd></div><div>Gras</div>
      <div><kbd>Ctrl+I</kbd></div><div>Italique</div>
      <div><kbd>Ctrl+F</kbd></div><div>Find & replace</div>
      <div><kbd>Ctrl+V</kbd></div><div>Vim mode</div>
      <div><kbd>Échap</kbd></div><div>Fermer modal / vim normal</div>
    </div>
    <h3 style="margin-top:18px">⌨ Vim (mode normal)</h3>
    <div class="help-grid">
      <div><kbd>h j k l</kbd></div><div>Déplacer curseur</div>
      <div><kbd>i a o O</kbd></div><div>Insérer</div>
      <div><kbd>Échap</kbd></div><div>Retour normal</div>
      <div><kbd>x</kbd></div><div>Supprimer caractère</div>
      <div><kbd>dd</kbd></div><div>Couper ligne</div>
      <div><kbd>yy</kbd></div><div>Copier ligne</div>
      <div><kbd>p</kbd></div><div>Coller ligne</div>
      <div><kbd>0 $</kbd></div><div>Début / fin de ligne</div>
      <div><kbd>g G</kbd></div><div>Début / fin du document</div>
      <div><kbd>:w</kbd></div><div>Sauvegarder</div>
      <div><kbd>:q</kbd></div><div>Fermer</div>
      <div><kbd>:x</kbd></div><div>Save + fermer</div>
      <div><kbd>/</kbd></div><div>Find & replace</div>
    </div>
    <h3 style="margin-top:18px">📹 Slides</h3>
    <p style="font-size:13px;color:var(--muted);line-height:1.6">Sépare tes slides par <code>---</code> sur une ligne vide. Clique sur 🎬 Slides pour ouvrir la présentation.</p>
    <h3 style="margin-top:18px">⚛ Manifesto</h3>
    <p style="font-size:13px;color:var(--muted);line-height:1.6">"If you can't ship it in one file, you don't understand it."<br>100% stdlib · 100% local · 100% monolith.</p>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Fermer</button></div>`;
  document.getElementById('modal').classList.add('show');
}

function scrollToOutline(){
  document.getElementById('outline-wrap').scrollIntoView({behavior:'smooth'});
}

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARD
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's'){ e.preventDefault(); saveCurrent(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !vimMode){ e.preventDefault(); fmt('bold'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'i' && !vimMode){ e.preventDefault(); fmt('italic'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f'){ e.preventDefault(); openFindReplace(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'v' && e.shiftKey){ e.preventDefault(); toggleVim(); }
  if (e.key === 'Escape'){ closeModal(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════
window.TEMPLATES = __TEMPLATES_JSON__;
loadTheme();
window.addEventListener('load', () => {
  loadFiles();
  render();
  setTimeout(() => toast('⚛ Plasma Studio · Linus Edition prêt'), 300);
});
</script>

</body>
</html>"""

# ═══════════════════════════════════════════════════════════════════════════════
# §13 — HTTP HANDLER
# ═══════════════════════════════════════════════════════════════════════════════

class Handler(BaseHTTPRequestHandler):
    server_version = "PlasmaStudio/" + VERSION
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):  # silence default logging
        pass

    def _send(self, code: int, body, ctype: str = "application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        try:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _json(self, code: int, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False, default=str))

    def _read_json(self) -> Dict:
        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except Exception:
            length = 0
        if length <= 0 or length > MAX_FILE_SIZE:
            return {}
        try:
            raw = self.rfile.read(length).decode("utf-8", "ignore")
            return json.loads(raw or "{}")
        except Exception:
            return {}

    # ─── GET ─────────────────────────────────────────────────────────────────
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        try:
            # Home
            if path in ("/", "/index.html"):
                html_out = HTML_UI.replace(
                    "__TEMPLATES_JSON__",
                    json.dumps(TEMPLATES, ensure_ascii=False),
                )
                return self._send(200, html_out, "text/html; charset=utf-8")

            # Health
            if path == "/api/health":
                return self._json(200, {
                    "status": "ok",
                    "version": VERSION,
                    "uptime_s": time.time() - START_TIME,
                    "files": len(DB.list_files()),
                })

            # Files list
            if path == "/api/files":
                return self._json(200, DB.list_files())

            # Load file
            if path.startswith("/api/load/"):
                name = urllib.parse.unquote(path[len("/api/load/"):])
                safe = safe_filename(name)
                if not safe:
                    return self._json(400, {"error": "nom invalide"})
                f = DB.get_file(safe)
                if not f:
                    return self._json(404, {"error": "fichier introuvable"})
                return self._json(200, {
                    "name": f["name"],
                    "content": f["content"],
                    "hash": f["hash"],
                })

            # Stats
            if path == "/api/stats":
                backups = BACKUP.list_backups()
                return self._json(200, {
                    "version": VERSION,
                    "codename": CODENAME,
                    "files_count": len(DB.list_files()),
                    "backups_count": len(backups),
                    "uptime_s": time.time() - START_TIME,
                    "git_enabled": GIT.enabled,
                    "rust_available": BENCH.rust_ok,
                    "threads": threading.active_count(),
                })

            # History
            if path == "/api/history":
                limit = int(qs.get("limit", ["50"])[0])
                return self._json(200, DB.history(limit))

            # Search
            if path == "/api/search":
                q = qs.get("q", [""])[0]
                return self._json(200, DB.search(q))

            # Backups list
            if path == "/api/backups":
                name = qs.get("name", [None])[0]
                return self._json(200, BACKUP.list_backups(name))

            # Diff (current content vs last backup)
            if path == "/api/diff":
                name = safe_filename(qs.get("name", [""])[0])
                if not name:
                    return self._json(400, {"error": "nom invalide"})
                f = DB.get_file(name)
                if not f:
                    return self._json(404, {"error": "introuvable"})
                backups = BACKUP.list_backups(name)
                if not backups:
                    return self._json(200, {"lines": []})
                last = BACKUP.read_backup(backups[0]["name"])
                if last is None:
                    return self._json(200, {"lines": []})
                import difflib
                diff = list(difflib.unified_diff(
                    last.splitlines(keepends=False),
                    f["content"].splitlines(keepends=False),
                    fromfile="backup",
                    tofile="current",
                    lineterm="",
                ))
                # Strip +++ / --- / @@ lines, keep +/-
                lines = [l for l in diff if l.startswith("+") or l.startswith("-") or l.startswith(" ")]
                return self._json(200, {"lines": lines[:200]})

            # System snapshot
            if path == "/api/sys":
                return self._json(200, SYS.snapshot())

            # Bench
            if path == "/api/bench":
                n = int(qs.get("n", ["35"])[0])
                n = max(1, min(n, 45))
                return self._json(200, BENCH.run(n))

            # File watcher diff
            if path == "/api/watch":
                return self._json(200, WATCHER.diff())

            # Git log
            if path == "/api/git":
                return self._json(200, {"log": GIT.log_short(10)})

            # Slides
            if path.startswith("/slides/"):
                name = urllib.parse.unquote(path[len("/slides/"):])
                safe = safe_filename(name)
                if not safe:
                    return self._send(400, "nom invalide", "text/plain; charset=utf-8")
                f = DB.get_file(safe)
                if not f:
                    return self._send(404, "introuvable", "text/plain; charset=utf-8")
                return self._send(200, slides_export(safe, f["content"]),
                                  "text/html; charset=utf-8")

            return self._json(404, {"error": "not found"})

        except Exception as e:
            log("ERR", f"GET {path} : {e}")
            return self._json(500, {"error": str(e)[:200]})

    # ─── POST ────────────────────────────────────────────────────────────────
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        data = self._read_json()

        try:
            if path == "/api/save":
                name = safe_filename(data.get("name", ""))
                content = data.get("content", "")
                if not name:
                    return self._json(400, {"error": "nom invalide"})
                if len(content) > MAX_FILE_SIZE:
                    return self._json(413, {"error": "fichier trop gros"})
                existing = DB.get_file(name)
                if existing:
                    BACKUP.backup(name, existing["content"])
                result = DB.upsert_file(name, content)
                # Mirror to disk
                try:
                    (WORKSPACE / name).write_text(content, encoding="utf-8")
                except Exception as e:
                    log("WARN", f"disk mirror failed: {e}")
                # Git auto-commit
                if GIT.enabled:
                    threading.Thread(
                        target=lambda: GIT.commit(f"auto: save {name}"),
                        daemon=True,
                    ).start()
                return self._json(200, {"name": name, **result})

            if path == "/api/create":
                name = safe_filename(data.get("name", ""))
                if not name:
                    return self._json(400, {"error": "nom invalide"})
                if DB.get_file(name):
                    return self._json(409, {"error": "existe déjà"})
                title = name.replace(".md", "").replace("-", " ").title()
                content = f"# {title}\n\n"
                DB.upsert_file(name, content)
                try:
                    (WORKSPACE / name).write_text(content, encoding="utf-8")
                except Exception:
                    pass
                return self._json(200, {"name": name})

            if path == "/api/delete":
                name = safe_filename(data.get("name", ""))
                if not name:
                    return self._json(400, {"error": "nom invalide"})
                DB.delete_file(name)
                try:
                    (WORKSPACE / name).unlink(missing_ok=True)
                except Exception:
                    pass
                return self._json(200, {"ok": True})

            if path == "/api/backup":
                name = safe_filename(data.get("name", ""))
                content = data.get("content", "")
                if not name:
                    return self._json(400, {"error": "nom invalide"})
                bf = BACKUP.backup(name, content)
                return self._json(200, {"file": bf.name})

            if path == "/api/restore":
                backup_name = data.get("backup", "")
                original = safe_filename(data.get("original", ""))
                if not original or not backup_name:
                    return self._json(400, {"error": "params manquants"})
                # Restore from disk backup
                content = BACKUP.read_backup(backup_name)
                if content is None:
                    return self._json(404, {"error": "backup introuvable"})
                DB.upsert_file(original, content)
                try:
                    (WORKSPACE / original).write_text(content, encoding="utf-8")
                except Exception:
                    pass
                return self._json(200, {"ok": True})

            if path == "/api/export":
                name = safe_filename(data.get("name", ""))
                if not name:
                    return self._json(400, {"error": "nom invalide"})
                f = DB.get_file(name)
                if not f:
                    return self._json(404, {"error": "introuvable"})
                # HTML standalone export
                export_path = EXPORTS / (name.replace(".md", ".html"))
                export_path.write_text(html_export_standalone(name, f["content"]),
                                       encoding="utf-8")
                # Also raw markdown
                md_path = EXPORTS / name
                md_path.write_text(f["content"], encoding="utf-8")
                return self._json(200, {"path": str(export_path), "md": str(md_path)})

            if path == "/api/calc":
                expr = data.get("expr", "")
                return self._json(200, CALC.evaluate(expr))

            return self._json(404, {"error": "not found"})

        except Exception as e:
            log("ERR", f"POST {path} : {e}")
            return self._json(500, {"error": str(e)[:200]})


class Server(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


# ═══════════════════════════════════════════════════════════════════════════════
# §14 — MAIN
# ═══════════════════════════════════════════════════════════════════════════════

START_TIME = time.time()


def banner():
    """Print the manifesto + version info on launch."""
    print(MANIFESTO)
    print(f"  Version   : {VERSION}")
    print(f"  Codename  : {CODENAME}")
    print(f"  Auteur    : {AUTEUR}")
    print(f"  Licence   : {LICENCE}")
    print(f"  Base      : {BASE}")
    print(f"  Host:Port : {HOST}:{PORT}")
    print(f"  Python    : {platform.python_version()}")
    print(f"  Git       : {'✓ activé' if GIT.enabled else '✗ désactivé'}")
    print(f"  Rust      : {'✓ ' + str(RUST_BIN) if BENCH.rust_ok else '✗ non compilé (bench Python seulement)'}")
    print(f"  Threads  : {threading.active_count()}")
    print("")
    print(f"  → http://{HOST}:{PORT}/")
    print("")
    print("  Ctrl+C pour arrêter. Vim mode: Ctrl+Shift+V.")
    print("")


def run_server():
    try:
        srv = Server((HOST, PORT), Handler)
        log("OK", f"serveur démarré : http://{HOST}:{PORT}/")
        srv.serve_forever()
    except OSError as e:
        log("ERR", f"port {PORT} occupé : {e}")
        log("INFO", f"libère avec : lsof -ti :{PORT} | xargs kill -9")
        log("INFO", f"ou change le port : PLASMA_PORT=2010 python3 plasma.py")
        sys.exit(1)


def main():
    banner()
    # Start file watcher (every 5s)
    WATCHER.start(interval=5.0)
    # Auto-open browser after 1.5s (skip if PLASMA_NO_OPEN=1)
    if os.environ.get("PLASMA_NO_OPEN", "0") != "1":
        threading.Timer(1.5, lambda: webbrowser.open(f"http://{HOST}:{PORT}/")).start()
    try:
        run_server()
    except KeyboardInterrupt:
        print("\n  Arrêt demandé.")
        log("INFO", "arrêt utilisateur")
        sys.exit(0)


if __name__ == "__main__":
    main()
__PYTHON_EOF__
  echo "  écrit : $PY_FILE ($(wc -l < "$PY_FILE") lignes)"
}

# ─── extract embedded rust ────────────────────────────────────────────────
extract_rust() {
  cat > "$RS_FILE" <<'__RUST_EOF__'
// plasma_bench.rs — tiny Fibonacci benchmark helper for Plasma Studio
// Compiled at first launch by nexus-plasma.sh if rustc is available.
// Output: JSON {"fib":N, "result":M, "ns":K} to stdout.

use std::env;
use std::time::Instant;

fn fib(n: u64) -> u64 {
    if n < 2 {
        return n;
    }
    let mut a: u64 = 0;
    let mut b: u64 = 1;
    for _ in 0..(n - 1) {
        let c = a + b;
        a = b;
        b = c;
    }
    b
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let n: u64 = args
        .get(1)
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(35);
    let n = n.min(45); // safety cap
    let start = Instant::now();
    let result = fib(n);
    let elapsed_ns = start.elapsed().as_nanos();
    println!(
        "{{\"fib\":{},\"result\":{},\"ns\":{}}}",
        n, result, elapsed_ns
    );
}
__RUST_EOF__
}

# ─── optional rust build ──────────────────────────────────────────────────
build_rust() {
  if ! command -v rustc &>/dev/null; then
    echo "✗ rustc absent — bench Rust désactivé (le bench Python reste dispo)"
    echo "  (installe Rust : https://rustup.rs/ — optionnel, pas bloquant)"
    return 1
  fi
  echo "✓ rustc détecté : $(rustc --version)"
  echo "→ Compilation du helper Rust (bench fibonacci)..."
  if rustc -O "$RS_FILE" -o "$RS_BIN" 2>/dev/null; then
    echo "  ✓ binaire : $RS_BIN"
    return 0
  fi
  echo "  ✗ compilation Rust échouée — bench Python seulement"
  return 1
}

# ─── cleanup on exit ──────────────────────────────────────────────────────
cleanup() {
  if [[ -n "${PLASMA_KEEP_CACHE:-1}" ]]; then
    :
  else
    rm -f "$PY_FILE" "$RS_FILE" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ─── main ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║        NEXUS PLASMA STUDIO  —  LINUS EDITION v$VERSION                         ║"
echo "║        $CODENAME                                                       ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

extract_python
extract_rust
build_rust || true

# Env vars handed to Python
export PLASMA_RUST_BIN="$RS_BIN"
export PLASMA_HOST="${PLASMA_HOST:-127.0.0.1}"
export PLASMA_PORT="${PLASMA_PORT:-2009}"
export PLASMA_NO_OPEN="${PLASMA_NO_OPEN:-0}"
export PLASMA_GIT="${PLASMA_GIT:-1}"

echo ""
echo "→ Lancement : $PYBIN $PY_FILE"
echo "  Host    : $PLASMA_HOST"
echo "  Port    : $PLASMA_PORT"
echo "  Rust    : $([[ -x "$RS_BIN" ]] && echo 'oui' || echo 'non')"
echo "  Git     : $([[ "$PLASMA_GIT" == "1" ]] && echo 'oui' || echo 'non')"
echo "  Browser : $([[ "$PLASMA_NO_OPEN" == "1" ]] && echo 'non (PLASMA_NO_OPEN=1)' || echo 'oui')"
echo ""

exec "$PYBIN" "$PY_FILE" "$@"
