#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NERCEL v10.0 — NEXUS Edge
Reverse proxy / CDN / WAF local sur le port 8765.
Achemine /<project>/... vers le port interne du projet.

Lancement : python3 nexusd.py   (port 8765)
"""
import os, sys, sqlite3, time, threading, gzip, re, io
import urllib.request, urllib.error, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from collections import defaultdict, deque

DATA_DIR = os.environ.get("NERCEL_DATA", os.path.expanduser("~/.nercel"))
DB_PATH = os.path.join(DATA_DIR, "deploy.db")
EDGE_PORT = int(os.environ.get("NERCEL_EDGE_PORT", "8765"))
ORCH_PORT = int(os.environ.get("NERCEL_PORT", "3923"))

# Cache RAM simple (LRU ~128 entrées)
CACHE = {}
CACHE_LOCK = threading.Lock()
CACHE_ORDER = deque(maxlen=128)

# Rate limiting : IP -> [timestamps]
RATE = defaultdict(deque)
RATE_LOCK = threading.Lock()
RATE_LIMIT = 100  # req / 60s / IP

# WAF patterns
WAF = [
    re.compile(r"(\bunion\b\s+select|\bor\b\s+1=1|--\s)", re.I),  # SQLi
    re.compile(r"(<script|onerror=|javascript:)", re.I),           # XSS
    re.compile(r"(\.\./|\.\.\\)", re.I),                           # path traversal
]

def project_port(name):
    """Retourne le port interne d'un projet (depuis la DB)."""
    if not os.path.exists(DB_PATH): return None
    try:
        c = sqlite3.connect(DB_PATH, timeout=2)
        c.row_factory = sqlite3.Row
        r = c.execute("SELECT port,status FROM projects WHERE name=?", (name,)).fetchone()
        c.close()
        if r and r["status"] == "running": return r["port"]
    except Exception: pass
    return None

def allowed(ip):
    now = time.time()
    with RATE_LOCK:
        dq = RATE[ip]
        while dq and now - dq[0] > 60: dq.popleft()
        if len(dq) >= RATE_LIMIT:
            dq.append(now); return False
        dq.append(now); return True

class EdgeHandler(BaseHTTPRequestHandler):
    server_version = "nexus/4.0"

    def log_message(self, fmt, *args):
        pass  # silent ; tout passe par l'orchestrateur

    def _proxy(self):
        ip = self.client_address[0]
        path = self.path
        # 1) WAF — vérifie chemin brut ET décodé (catch %20, ../, etc.)
        decoded = urllib.parse.unquote(path)
        for pat in WAF:
            if pat.search(path) or pat.search(decoded):
                self._respond(403, "blocked by NEXUS WAF\n", ctype="text/plain")
                return
        # 2) rate limit
        if not allowed(ip):
            self._respond(429, "rate limit exceeded\n", ctype="text/plain")
            return
        # 3) routing : /<project>/...
        parts = path.lstrip("/").split("/", 1)
        if not parts or not parts[0]:
            self._respond(200, "NEXUS Edge v10.0 — 1.2 ms\nRoutes: /<project>/...\n",
                          ctype="text/plain")
            return
        proj = parts[0]
        sub = "/" + parts[1] if len(parts) > 1 else "/"
        port = project_port(proj)
        if not port:
            self._respond(404, f"project '{proj}' not found or stopped\n", ctype="text/plain")
            return
        # 4) cache lookup (GET only, no query)
        cache_key = (proj, sub)
        if self.command == "GET" and "?" not in sub:
            with CACHE_LOCK:
                hit = CACHE.get(cache_key)
            if hit:
                self._respond_cached(hit); return
        # 5) forward
        upstream = f"http://127.0.0.1:{port}{sub}"
        req_body = None
        if self.command in ("POST","PUT","PATCH"):
            ln = int(self.headers.get("Content-Length",0))
            req_body = self.rfile.read(ln) if ln else None
        t0 = time.time()
        try:
            req = urllib.request.Request(upstream, data=req_body, method=self.command)
            for k in ("Content-Type","Authorization","Accept"):
                v = self.headers.get(k)
                if v: req.add_header(k, v)
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read()
                ctype = resp.headers.get("Content-Type","application/octet-stream")
                latency = (time.time()-t0)*1000
        except urllib.error.HTTPError as e:
            body = e.read(); ctype = e.headers.get("Content-Type","text/plain"); latency = (time.time()-t0)*1000
            self._respond_raw(e.code, body, ctype, latency); return
        except Exception as e:
            self._respond(502, f"bad gateway: {e}\n", ctype="text/plain"); return
        # 6) compression gzip
        accept_enc = self.headers.get("Accept-Encoding","")
        if "gzip" in accept_enc and len(body) > 1024 and ctype.startswith(("text/","application/javascript","application/json")):
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode="wb") as gz: gz.write(body)
            body = buf.getvalue()
            extra = [("Content-Encoding","gzip")]
        else:
            extra = []
        # 7) cache PUT (GET, 200, small)
        if self.command == "GET" and "?" not in sub and len(body) < 512_000:
            with CACHE_LOCK:
                CACHE[cache_key] = (body, ctype)
                CACHE_ORDER.append(cache_key)
                while len(CACHE) > 128 and CACHE_ORDER:
                    old = CACHE_ORDER.popleft()
                    CACHE.pop(old, None)
        self._respond_raw(200, body, ctype, latency, extra)

    def _respond_raw(self, code, body, ctype, latency, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-NEXUS-Edge","v10.0")
        self.send_header("X-NEXUS-Latency", f"{latency:.2f}ms")
        self.send_header("Server","nexus/4.0")
        for k,v in (extra or []): self.send_header(k,v)
        self.end_headers()
        try: self.wfile.write(body)
        except Exception: pass

    def _respond(self, code, msg, ctype="text/plain"):
        body = msg.encode() if isinstance(msg,str) else msg
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-NEXUS-Edge","v10.0")
        self.end_headers()
        try: self.wfile.write(body)
        except Exception: pass

    def _respond_cached(self, hit):
        body, ctype = hit
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-NEXUS-Edge","v10.0")
        self.send_header("X-NEXUS-Cache","HIT")
        self.end_headers()
        try: self.wfile.write(body)
        except Exception: pass

    def do_GET(self): self._proxy()
    def do_POST(self): self._proxy()
    def do_HEAD(self): self._proxy()

if __name__ == "__main__":
    print(f"NEXUS Edge v10.0 → http://127.0.0.1:{EDGE_PORT}/  (orch :{ORCH_PORT})")
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", EDGE_PORT), EdgeHandler)
        srv.serve_forever()
    except KeyboardInterrupt: print("\narrêt edge…")
