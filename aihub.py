#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
aihub.py — NERCEL v10 : hub IA multi-fournisseurs (30+ IA gratuites, zéro clé).

Architecture :
  • LOCAL d'abord : découverte auto des runtimes sur la machine
      - Ollama       http://127.0.0.1:11434  (POST /api/chat, OpenAI-compat /v1/chat/completions)
      - LM Studio    http://127.0.0.1:1234   (OpenAI-compat /v1/chat/completions)
      - llama.cpp    http://127.0.0.1:8080   (OpenAI-compat /v1/chat/completions)
      - Jan          http://127.0.0.1:1337   (OpenAI-compat)
      - vLLM         http://127.0.0.1:8000   (OpenAI-compat)
      - text-gen-webui http://127.0.0.1:5000 (OpenAI-compat /v1)
      - Cobra/LM Studio alternatives 8xxx-9xxx
  • CLOUD ensuite (keyless, sans compte) :
      - Pollinations (openai-fast = GPT-OSS-20B, etc.) — 1 req/45s anonyme
      - DuckDuckGo AI (gpt-4o-mini, claude, llama, mixtral — via VQD, sans clé)
      - ... voir LOCAL_PORTS
  • Fallback automatique : si un fournisseur échoue (erreur/rate-limit), on passe
    au suivant ; cooldown 60s par fournisseur pour ne pas le marteler.
"""
import json, os, subprocess, time, threading, urllib.request, urllib.parse, urllib.error

# ----------------------------------------------------------------------------
# Runtimes locaux : (nom, port, chemin OpenAI-compat, note)
# ----------------------------------------------------------------------------
LOCAL_RUNTIMES = [
    ("ollama",       11434, "/v1/chat/completions", "Ollama — le plus simple, https://ollama.com"),
    ("lmstudio",     1234,  "/v1/chat/completions", "LM Studio — server local, https://lmstudio.ai"),
    ("jan",          1337,  "/v1/chat/completions", "Jan — desktop open source, https://jan.ai"),
    ("llamacpp",     8080,  "/v1/chat/completions", "llama.cpp server (llama-server)"),
    ("vllm",         8000,  "/v1/chat/completions", "vLLM (production, GPU)"),
    ("textgenwebui", 5000,  "/v1/chat/completions", "text-generation-webui (--api)"),
    ("localai",      8081,  "/v1/chat/completions", "LocalAI"),
    ("koboldcpp",    5001,  "/v1/chat/completions", "KoboldCpp (--openai-compatible)"),
    ("oobabooga",    5000,  "/v1/chat/completions", "alias textgen"),
    ("cobra",        9090,  "/v1/chat/completions", "Cobra (Node)"),
]

# ----------------------------------------------------------------------------
# Fournisseurs cloud keyless (aucune clé API requise)
# ----------------------------------------------------------------------------
POLLINATIONS_MODELS = [
    # (id affiché, modèle API, description)
    ("pollinations/openai-fast",  "openai-fast",  "GPT-OSS 20B reasoning (OVH) — rapide, tools"),
    ("pollinations/openai",       "openai",       "alias openai-fast"),
    ("pollinations/openai-large", "openai-large", "GPT-OSS 120B — plus puissant"),
    ("pollinations/qwen-coder",   "qwen-coder",   "Qwen 2.5 Coder 32B — code"),
    ("pollinations/mistral",      "mistral",      "Mistral Small 3.1 24B"),
    ("pollinations/llama-roblox", "llama-roblox", "Llama 3.1 8B (Roblox finetune)"),
    ("pollinations/phi",          "phi",          "Phi-4 Mini"),
    ("pollinations/deepseek",     "deepseek",     "DeepSeek v3"),
    ("pollinations/searchgpt",    "searchgpt",    "SearchGPT — avec recherche web"),
    ("pollinations/sur",          "sur",          "Sur Mentality 11B"),
    ("pollinations/sur-mistral",  "sur-mistral",  "Sur AI Agent 70B"),
    ("pollinations/unity",        "unity",        "Unity Mistral (autonomous agent)"),
    ("pollinations/mirexa",       "mirexa",       "Mirexa Smart 4B"),
    ("pollinations/bidara",       "bidara",       "BIDARA bio-inspired designer"),
    ("pollinations/evil",         "evil",         "Evil (unhinged, test)"),
    ("pollinations/gpt-5",        "gpt-5",        "GPT-5 via Pollinations (si dispo)"),
]
DDG_MODELS = ["gpt-4o-mini", "claude-3-haiku-20240307", "llama-3.1-70b", "mixtral-8x7b-3"]

def build_registry():
    """Registre complet des IA disponibles : locales découvertes + cloud keyless."""
    reg = []
    for name, port, path, note in LOCAL_RUNTIMES:
        base = f"http://127.0.0.1:{port}"
        reg.append({"id": f"local/{name}", "name": name, "kind": "local", "base": base,
                    "path": path, "note": note, "alive": _probe(base + "/api/tags", name) if name == "ollama" else _probe(base, name)})
    for mid, model, desc in POLLINATIONS_MODELS:
        reg.append({"id": mid, "name": mid.split("/")[1], "kind": "cloud", "provider": "pollinations",
                    "model": model, "desc": desc, "keyless": True})
    for m in DDG_MODELS:
        reg.append({"id": f"ddg/{m}", "name": m, "kind": "cloud", "provider": "duckduckgo",
                    "model": m, "desc": "DuckDuckGo AI chat (VQD, sans clé)", "keyless": True})
    return reg

# ----------------------------------------------------------------------------
# Sondage santé
# ----------------------------------------------------------------------------
def _probe(url, name, timeout=1.2):
    try:
        req = urllib.request.Request(url, method="GET")
        urllib.request.urlopen(req, timeout=timeout).read(1)
        return True
    except Exception:
        return False

# ----------------------------------------------------------------------------
# État runtime (cooldown par fournisseur)
# ----------------------------------------------------------------------------
_COOLDOWN = {}          # provider_id -> expiry ts
_COOLDOWN_S = 60
_LOCK = threading.Lock()

def _cool(provider_id, set_it=None):
    with _LOCK:
        if set_it is not None:
            _COOLDOWN[provider_id] = time.time() + set_it
        return _COOLDOWN.get(provider_id, 0) > time.time()

# ----------------------------------------------------------------------------
# Appels
# ----------------------------------------------------------------------------
def _timeout_for(messages):
    n = sum(len(m.get("content","")) for m in messages)
    return min(120, 20 + n // 50)

def _post_json(url, payload, headers=None, timeout=30):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read() or b"{}")

def _pollinations_chat(messages, model, system=None):
    msgs = ([{"role":"system","content":system}] if system else []) + messages
    # 1) endpoint OpenAI-compat (POST) — prioritaire (moins de rate-limit)
    try:
        st, d = _post_json("https://text.pollinations.ai/openai",
                           {"model": model, "messages": msgs, "temperature": 0.7},
                           timeout=_timeout_for(msgs))
        if st == 200:
            return d["choices"][0]["message"]["content"].strip()
        # 402 FREE_LIMIT → tenter GET simple
    except urllib.error.HTTPError as e:
        if e.code == 402:
            pass  # rate-limit anonyme → fallback GET
        else:
            raise
    # 2) endpoint GET simple (text.pollinations.ai/<prompt>)
    prompt = "\n".join(f"{m['role']}: {m['content']}" for m in msgs)[-1500:]
    url = f"https://text.pollinations.ai/{urllib.parse.quote(prompt)}?model={urllib.parse.quote(model)}"
    with urllib.request.urlopen(url, timeout=_timeout_for(msgs)) as r:
        txt = r.read().decode("utf-8","ignore").strip()
    if txt.startswith("Free limit reached") or "FREE_LIMIT" in txt:
        raise RuntimeError("pollinations rate-limit")
    return txt

def _ddg_chat(messages, model, system=None):
    """DuckDuckGo AI Chat sans clé — flux VQD : GET status → x-vqd-4 → POST chat."""
    hdrs = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) nercel/10.0"}
    req = urllib.request.Request("https://duckduckgo.com/duckchat/v1/status", headers={**hdrs, "x-vqd-accept": "1"})
    with urllib.request.urlopen(req, timeout=10) as r:
        vqd = r.headers.get("x-vqd-4") or r.headers.get("x-vqd")
    if not vqd:
        raise RuntimeError("DuckDuckGo VQD indisponible")
    payload = {"model": model, "messages": [{"role":"user","content": "\n".join(m["content"] for m in messages)}]}
    st, d = _post_json("https://duckduckgo.com/duckchat/v1/chat", payload,
                       headers={**hdrs, "x-vqd-4": vqd}, timeout=30)
    if isinstance(d.get("message"), str):
        return d["message"].strip()
    raise RuntimeError(f"DDG réponse inattendue: {str(d)[:120]}")

def _local_chat(base, path, messages, model, system=None):
    msgs = ([{"role":"system","content":system}] if system else []) + messages
    payload = {"model": model or "default", "messages": msgs, "stream": False}
    st, d = _post_json(base + path, payload, timeout=_timeout_for(msgs))
    return d["choices"][0]["message"]["content"].strip()

def ollama_tags():
    """Liste des modèles installés dans Ollama (si présent)."""
    try:
        with urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=2) as r:
            d = json.loads(r.read())
        return [m.get("name") for m in d.get("models", [])]
    except Exception:
        return []

def local_models():
    """Modèles disponibles sur les runtimes locaux détectés."""
    out = []
    tags = ollama_tags()
    if tags:
        for t in tags: out.append({"id": f"local/ollama:{t}", "name": t, "runtime": "ollama"})
    for name, port, _p, _n in LOCAL_RUNTIMES:
        if name == "ollama": continue
        base = f"http://127.0.0.1:{port}"
        if _probe(base + "/v1/models", name):
            try:
                with urllib.request.urlopen(base + "/v1/models", timeout=2) as r:
                    d = json.loads(r.read())
                for m in d.get("data", []):
                    out.append({"id": f"local/{name}:{m['id']}", "name": m["id"], "runtime": name})
            except Exception: pass
    return out

# ----------------------------------------------------------------------------
# CHAT — fallback automatique local → cloud
# ----------------------------------------------------------------------------
LAST = {"provider": None, "model": None, "ts": 0, "tried": []}

def _zai_available():
    """z-ai CLI présent ? (GLM — optionnel, souvent absent sur la machine cible)"""
    for p in ("/usr/local/bin/z-ai", "/usr/bin/z-ai"):
        if os.access(p, os.X_OK): return True
    try:
        subprocess.run(["z-ai", "--help"], capture_output=True, timeout=4)
        return True
    except Exception:
        return False

def _zai_chat(messages, system=None):
    """GLM via le CLI z-ai (si installé)."""
    import tempfile
    prompt = "\n".join(f"{m.get('role','user')}: {m.get('content','')}" for m in messages) or "Bonjour"
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tf:
        out = tf.name
    try:
        subprocess.run(["z-ai", "chat", "--prompt", prompt, "--system", system or "Tu es un assistant utile.", "-o", out],
                       capture_output=True, timeout=60)
        d = json.load(open(out))
        if "choices" in d:
            return d["choices"][0]["message"]["content"].strip()
        raise RuntimeError("réponse z-ai vide")
    finally:
        try: os.unlink(out)
        except Exception: pass

def chat(messages, system=None, prefer=None):
    """Chat via la chaîne de fallback. Retourne (reply, provider_id, model, notes).
    Priorité : 1) modèle local précis (préférence) 2) runtimes locaux 3) cloud keyless.
    GLM/z-ai en tout dernier recours s'il est présent."""
    notes = []
    tried = []
    # 1) LOCAL d'abord (zéro coût, privé, rapide) — sauf si l'utilisateur
    #    a demandé explicitement un provider cloud (pollinations/…, ddg/…)
    lms = local_models()
    use_local = (prefer is None or prefer in ("auto", "glm") or prefer.startswith("local/"))
    if lms and use_local:
        # filtre par préférence si demandé (ex: local/ollama:qwen2.5-coder)
        cands = lms
        if prefer and any(m["id"] == prefer for m in lms):
            cands = [m for m in lms if m["id"] == prefer]
        for m in cands[:4]:
            pid = m["id"]
            if _cool(pid): notes.append(f"cooldown: {pid}"); continue
            runtime = m["runtime"]; port = dict((n,p) for n,p,_a,_b in [(x[0],x[1],0,0) for x in LOCAL_RUNTIMES]).get(runtime)
            if port is None: continue
            base = f"http://127.0.0.1:{port}"
            try:
                reply = _local_chat(base, "/v1/chat/completions", messages, m["name"], system)
                LAST.update({"provider": pid, "model": m["name"], "ts": time.time(), "tried": tried})
                return reply, pid, m["name"], notes
            except Exception as e:
                tried.append(pid); _cool(pid, _COOLDOWN_S)
                notes.append(f"{pid}: {str(e)[:80]}")
    # 2) CLOUD keyless — Pollinations multi-modèles puis DuckDuckGo
    order = ["pollinations/openai-fast", "pollinations/mistral", "pollinations/qwen-coder",
             "pollinations/openai-large", "pollinations/deepseek",
             "ddg/gpt-4o-mini", "ddg/claude-3-haiku-20240307", "ddg/llama-3.1-70b", "ddg/mixtral-8x7b-3"]
    if prefer and prefer in [p[0] for p in POLLINATIONS_MODELS]:
        order = [prefer] + [p for p in order if p != prefer]
    for pid in order:
        if _cool(pid): notes.append(f"cooldown: {pid}"); continue
        try:
            if pid.startswith("pollinations/"):
                model = pid.split("/",1)[1]
                reply = _pollinations_chat(messages, model, system)
            else:
                model = pid.split("/",1)[1]
                reply = _ddg_chat(messages, model, system)
            LAST.update({"provider": pid, "model": model, "ts": time.time(), "tried": tried})
            return reply, pid, model, notes
        except Exception as e:
            tried.append(pid); _cool(pid, _COOLDOWN_S)
            notes.append(f"{pid}: {str(e)[:80]}")
    # 3) dernier recours : GLM (z-ai) si le CLI existe sur cette machine
    if prefer in (None, "glm", "glm/z-ai-flash") and _zai_available() and not _cool("glm/z-ai-flash"):
        try:
            reply = _zai_chat(messages, system)
            LAST.update({"provider": "glm/z-ai-flash", "model": "glm-flash", "ts": time.time(), "tried": tried})
            return reply, "glm/z-ai-flash", "glm-flash", notes
        except Exception as e:
            tried.append("glm/z-ai-flash"); _cool("glm/z-ai-flash", _COOLDOWN_S)
            notes.append(f"glm/z-ai-flash: {str(e)[:80]}")
    LAST.update({"provider": None, "ts": time.time(), "tried": tried})
    hint = "Installe Ollama (https://ollama.com) puis : ollama pull qwen2.5-coder:7b"
    return (f"(aucun fournisseur IA disponible — {len(tried)} tenté(s). {hint})", "none", "none", notes)

# ----------------------------------------------------------------------------
# Diagnostics
# ----------------------------------------------------------------------------
def providers_status():
    reg = build_registry()
    return {
        "local": [r for r in reg if r["kind"] == "local"],
        "cloud": [r for r in reg if r["kind"] == "cloud"],
        "local_models": local_models(),
        "ollama_installed": _probe("http://127.0.0.1:11434/api/tags", "ollama"),
        "ollama_bin": bool(_which("ollama")),
        "last": {"provider": LAST.get("provider"), "model": LAST.get("model"),
                 "ts": LAST.get("ts"), "tried": LAST.get("tried", [])},
        "total_cloud": len([r for r in reg if r["kind"]=="cloud"]),
        "total_local_runtimes": len(LOCAL_RUNTIMES),
    }

def _which(cmd):
    try:
        subprocess.run([cmd, "--version"], capture_output=True, timeout=4)
        return True
    except Exception:
        return False
