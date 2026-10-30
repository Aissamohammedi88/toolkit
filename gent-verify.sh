#!/usr/bin/env bash
# =============================================================================
#  GENT — Protocole Senior de Vérification (9 contrôles)
#  Usage : bash gent-verify.sh   (ou : gent verify)
#  Sortie : PASS / FAIL / SKIP par contrôle — code de sortie 0 si aucun FAIL.
# =============================================================================
set -uo pipefail
umask 077

GENT_HOME="${GENT_HOME:-$HOME/gent}"
GENT_PORT="${GENT_PORT:-4310}"
PASS=0; FAIL=0; SKIP=0

pass() { printf '  \033[1;32mPASS\033[0m  %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31mFAIL\033[0m  %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33mSKIP\033[0m  %s\n' "$*"; SKIP=$((SKIP+1)); }

cat <<'HDR'

  ══════════════════════════════════════════════════════════════════
   GENT · PROTOCOLE SENIOR — VÉRIFICATION D'INFRASTRUCTURE
  ══════════════════════════════════════════════════════════════════
HDR

# 1 — préfixe isolé
if [ -d "$GENT_HOME" ]; then
  pass "1/9 préfixe isolé présent : $GENT_HOME"
else
  fail "1/9 préfixe isolé absent : $GENT_HOME (lance gent-install.sh)"
fi

# 2 — runtime Node 22 cloné
NODE_BIN="$GENT_HOME/runtime/current/bin/node"
if [ -x "$NODE_BIN" ]; then
  V="$("$NODE_BIN" --version 2>/dev/null)"
  case "$V" in
    v22.*) pass "2/9 runtime Node 22 cloné : $V" ;;
    *)     fail "2/9 runtime inattendu : $V (v22.x attendu)" ;;
  esac
else
  fail "2/9 runtime absent : $NODE_BIN"
fi

# 3 — identité unique valide
IDENT_FILE="$GENT_HOME/identity/instance.json"
if [ -f "$IDENT_FILE" ]; then
  if command -v python3 >/dev/null 2>&1 && python3 -m json.tool "$IDENT_FILE" >/dev/null 2>&1; then
    IID="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("instance_id",""))' "$IDENT_FILE" 2>/dev/null)"
    if printf '%s' "$IID" | grep -Eq '^GENT-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$'; then
      pass "3/9 identité unique valide : $IID"
    else
      fail "3/9 instance_id malformé : '$IID'"
    fi
  else
    fail "3/9 instance.json illisible (JSON invalide)"
  fi
else
  fail "3/9 identité absente : $IDENT_FILE"
fi

# 4 — jeton scellé
if [ -f "$IDENT_FILE" ]; then
  TOK_OK="$(python3 -c 'import json,sys,re;t=json.load(open(sys.argv[1])).get("auth_token","");print("ok" if re.fullmatch(r"[0-9a-f]{64}",t) else "ko")' "$IDENT_FILE" 2>/dev/null)"
  PERM="$(stat -c '%a' "$IDENT_FILE" 2>/dev/null)"
  if [ "$TOK_OK" = "ok" ] && [ "$PERM" = "600" ]; then
    pass "4/9 jeton d'instance scellé (64 hex, chmod 600)"
  else
    fail "4/9 jeton ou permissions défaillants (token=$TOK_OK perm=$PERM)"
  fi
else
  skip "4/9 jeton (identité absente)"
fi

# 5 — application valide
if command -v node >/dev/null 2>&1 || [ -x "$NODE_BIN" ]; then
  CHK_BIN="$NODE_BIN"; [ -x "$CHK_BIN" ] || CHK_BIN=node
  if [ -f "$GENT_HOME/app/gent-server.js" ] && "$CHK_BIN" --check "$GENT_HOME/app/gent-server.js" 2>/dev/null; then
    pass "5/9 app/gent-server.js valide (node --check)"
  else
    fail "5/9 app/gent-server.js absente ou invalide"
  fi
else
  skip "5/9 app (aucun node pour vérifier)"
fi

# 6 — manifeste du dernier build
LATEST_MAN="$(ls -1t "$GENT_HOME/identity/manifests/"*.sha256 2>/dev/null | head -n1 || true)"
if [ -n "$LATEST_MAN" ]; then
  if (cd "$GENT_HOME" && sha256sum -c "$LATEST_MAN" >/dev/null 2>&1); then
    pass "6/9 intégrité du build vérifiée : $(basename "$LATEST_MAN")"
  else
    fail "6/9 divergence du manifeste : $(basename "$LATEST_MAN") (relance gent build)"
  fi
else
  skip "6/9 manifeste (aucun build — lance : gent build)"
fi

# 7 — service systemd
if command -v systemctl >/dev/null 2>&1 && systemctl --user daemon-reload >/dev/null 2>&1; then
  ST="$(systemctl --user is-active gent-node.service 2>/dev/null)"
  if [ "$ST" = "active" ]; then
    pass "7/9 service systemd --user actif (autostart)"
  else
    fail "7/9 service systemd inactif ($ST) — systemctl --user enable --now gent-node.service"
  fi
else
  skip "7/9 service systemd (bus utilisateur indisponible dans cette session)"
fi

# 8 — santé HTTP + cohérence d'instance
HEALTH="$(curl -fsS --max-time 4 "http://127.0.0.1:${GENT_PORT}/api/health" 2>/dev/null || true)"
if [ -n "$HEALTH" ]; then
  HTTP_IID="$(printf '%s' "$HEALTH" | grep -o '"instance_id":"[^"]*"' | cut -d'"' -f4 || true)"
  FILE_IID="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("instance_id",""))' "$IDENT_FILE" 2>/dev/null || true)"
  if [ -n "$FILE_IID" ] && [ "$HTTP_IID" = "$FILE_IID" ]; then
    pass "8/9 santé HTTP :200 sur :$GENT_PORT — instance cohérente ($HTTP_IID)"
  else
    fail "8/9 santé HTTP mais incohérence d'instance (http=$HTTP_IID file=$FILE_IID)"
  fi
else
  fail "8/9 HTTP injoignable sur 127.0.0.1:$GENT_PORT (gent serve / systemctl --user start gent-node)"
fi

# 9 — zone sacrée ~/Aether
AETHER_ZONE="$HOME/Aether"
VIOLATION=0
if [ -e "$AETHER_ZONE" ]; then
  case "$GENT_HOME/" in
    "$AETHER_ZONE"/*|"$AETHER_ZONE") VIOLATION=1 ;;
  esac
fi
if [ "$VIOLATION" = 0 ]; then
  pass "9/9 zone sacrée ~/Aether INTACTE — GENT hors périmètre, aucune écriture"
else
  fail "9/9 VIOLATION : GENT_HOME ($GENT_HOME) est dans ~/Aether"
fi

cat <<FTR

  ──────────────────────────────────────────────────────────────────
   RÉSULTAT : $PASS PASS · $FAIL FAIL · $SKIP SKIP
FTR
if [ "$FAIL" -eq 0 ]; then
  echo "   STATUT   : PROTOCOLE SENIOR — VALIDÉ"
else
  echo "   STATUT   : CORRECTIONS REQUISES (voir FAIL ci-dessus)"
fi
echo "  ══════════════════════════════════════════════════════════════════"
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
