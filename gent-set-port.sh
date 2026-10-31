#!/usr/bin/env bash
# =============================================================================
#  GENT — Changement de port instantané (sans nano, sans interaction)
#
#  Usage :
#    bash gent-set-port.sh 4320        # porte GENT sur le port 4320
#    bash gent-set-port.sh --auto      # premier port libre dès 4320
#
#  Met à jour : unité systemd + identité + CLI `gent` + raccourcis bureau +
#  autostart — puis redémarre et vérifie la santé HTTP.
# =============================================================================
set -Eeuo pipefail
umask 077

log()  { printf '\033[1;35m[gent:port]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  ⚠\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[gent:port:ERREUR]\033[0m %s\n' "$*" >&2; exit 1; }

GENT_HOME="${GENT_HOME:-$HOME/gent}"
[ -d "$GENT_HOME" ] || die "GENT absent dans $GENT_HOME — lance d'abord gent-install.sh"

port_busy() {  # true si occupé
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$" && return 0 || return 1
  fi
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1
}

# ------------------------------------------------------------- cible port ---
ARG="${1:-}"
if [ -z "$ARG" ]; then
  die "usage : bash gent-set-port.sh <port|—auto>   (ex. : bash gent-set-port.sh 4320)"
fi
NEW_PORT="$ARG"
if [ "$NEW_PORT" = "--auto" ] || [ "$NEW_PORT" = "-a" ]; then
  NEW_PORT=""
  for cand in $(seq 4320 4399); do
    if ! port_busy "$cand"; then NEW_PORT="$cand"; break; fi
  done
  [ -n "$NEW_PORT" ] || die "aucun port libre trouvé entre 4320 et 4399"
  log "port libre détecté automatiquement : $NEW_PORT"
fi
case "$NEW_PORT" in ''|*[!0-9]*) die "port invalide : $NEW_PORT" ;; esac
[ "$NEW_PORT" -ge 1024 ] && [ "$NEW_PORT" -le 65535 ] || die "port hors plage 1024-65535 : $NEW_PORT"

# ancien port — source de vérité : unité systemd → raccourcis → identité
UNIT="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/gent-node.service"
OLD_PORT=""
if [ -f "$UNIT" ]; then
  OLD_PORT="$(grep -o 'Environment=PORT=[0-9]*' "$UNIT" 2>/dev/null | grep -o '[0-9]*$' || true)"
fi
if [ -z "$OLD_PORT" ]; then
  for f in "${XDG_DATA_HOME:-$HOME/.local/share}/applications/gent-founder.desktop" \
           "$HOME/Bureau/gent-founder.desktop" "$HOME/Desktop/gent-founder.desktop"; do
    if [ -f "$f" ]; then
      OLD_PORT="$(grep -o '127\.0\.0\.1:[0-9]*' "$f" | head -n1 | grep -o '[0-9]*$' || true)"
      break
    fi
  done
fi
[ -z "$OLD_PORT" ] && OLD_PORT="$(grep -o '"port": *[0-9]*' "$GENT_HOME/identity/instance.json" 2>/dev/null | grep -o '[0-9]*' || true)"
[ -n "$OLD_PORT" ] || OLD_PORT=4310

# déjà déménagé partout ? (unité + raccourcis + identité + CLI)
ALL_DONE=1
if [ -f "$UNIT" ] && ! grep -q "Environment=PORT=${NEW_PORT}" "$UNIT"; then ALL_DONE=0; fi
grep -q "GENT_PORT:-${NEW_PORT}" "$GENT_HOME/bin/gent" 2>/dev/null || ALL_DONE=0
grep -q '"port": *'"${NEW_PORT}" "$GENT_HOME/identity/instance.json" 2>/dev/null || ALL_DONE=0
if [ "$ALL_DONE" = 1 ]; then
  if port_busy "$NEW_PORT"; then
    ok "GENT est déjà sur le port $NEW_PORT partout (serveur en ligne) — rien à faire"
    SELF="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || true)"
    if [ -n "$SELF" ] && [ -f "$SELF" ] && [ "$SELF" != "$GENT_HOME/scripts/gent-set-port.sh" ]; then
      cp "$SELF" "$GENT_HOME/scripts/gent-set-port.sh" && chmod 700 "$GENT_HOME/scripts/gent-set-port.sh" \
        && ok "script archivé : ~/gent/scripts/gent-set-port.sh"
    fi
    exit 0
  fi
  warn "fichiers déjà sur $NEW_PORT mais serveur éteint — relance en cours"
fi
if port_busy "$NEW_PORT"; then
  die "le port $NEW_PORT est DÉJÀ OCCUPÉ — choisis-en un autre ou lance : bash gent-set-port.sh --auto"
fi

log "Déménagement GENT : $OLD_PORT → $NEW_PORT"
log "Zone sacrée ~/Aether : intouchée"

# --------------------------------------------------------- 1. service unit ---
if [ -f "$UNIT" ]; then
  sed -i "s/Environment=PORT=[0-9]*/Environment=PORT=${NEW_PORT}/" "$UNIT"
  sed -i "s/(port [0-9]*)/(port ${NEW_PORT})/" "$UNIT"
  chmod 600 "$UNIT"
  ok "unité systemd réécrite : PORT=$NEW_PORT"
fi

# ------------------------------------------------ 2. identité + CLI gent ---
sed -i "s/\"port\": *[0-9]*/\"port\": ${NEW_PORT}/" "$GENT_HOME/identity/instance.json"
chmod 600 "$GENT_HOME/identity/instance.json"
ok "identité stampée : port $NEW_PORT"

CLI="$GENT_HOME/bin/gent"
if [ -f "$CLI" ]; then
  sed -i "s/GENT_PORT:-[0-9]*/GENT_PORT:-${NEW_PORT}/" "$CLI"
  chmod 700 "$CLI"
  ok "CLI gent réaligné sur :$NEW_PORT (status / open / serve)"
fi

# ------------------------------------------------- 3. raccourcis bureau ---
CFG="${XDG_CONFIG_HOME:-$HOME/.config}"
USR_FILES=""
for f in "${XDG_DATA_HOME:-$HOME/.local/share}/applications/gent-founder.desktop" \
         "$HOME/Bureau/gent-founder.desktop" \
         "$HOME/Desktop/gent-founder.desktop" \
         "$CFG/autostart/gent-node.desktop"; do
if [ -f "$f" ]; then
  USR_FILES="$USR_FILES$f
"
fi
done
if [ -n "$USR_FILES" ]; then
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    sed -i "s|127\.0\.0\.1:${OLD_PORT}|127.0.0.1:${NEW_PORT}|g; s|port ${OLD_PORT}|port ${NEW_PORT}|g" "$f"
    case "$f" in *Bureau*|*Desktop*) chmod 755 "$f"; gio set "$f" metadata::trusted true >/dev/null 2>&1 || true ;; esac
  done <<< "$USR_FILES"
  ok "raccourcis bureau/menu/autostart mis à jour (${NEW_PORT})"
else
  warn "aucun raccourci trouvé — gent open utilisera le CLI"
fi

# ------------------------------------------------------- 4. redémarrage ---
RESTARTED=0
if command -v systemctl >/dev/null 2>&1 && systemctl --user daemon-reload >/dev/null 2>&1; then
  systemctl --user restart gent-node.service >/dev/null 2>&1 || systemctl --user enable --now gent-node.service >/dev/null 2>&1 || true
  RESTARTED=1
  ok "service systemd redémarré sur :$NEW_PORT"
else
  warn "systemd --user indisponible — relance directe du serveur"
  pkill -f "app/gent-server.js" 2>/dev/null || true
  sleep 0.5
  NODE_BIN="$GENT_HOME/runtime/current/bin/node"
  [ -x "$NODE_BIN" ] || NODE_BIN="$(command -v node || true)"
  [ -n "$NODE_BIN" ] || die "aucun node disponible"
  NODE_BIN="$NODE_BIN" GENT_HOME="$GENT_HOME" PORT="$NEW_PORT" NODE_COMPILE_CACHE="$GENT_HOME/cache/v8" \
    setsid "$NODE_BIN" --max-semi-space-size=64 "$GENT_HOME/app/gent-server.js" >>"$GENT_HOME/logs/service.log" 2>&1 &
  disown 2>/dev/null || true
  RESTARTED=1
fi

# -------------------------------------------------------- 5. santé HTTP ---
healthy=0
for i in $(seq 1 25); do
  if curl -fsS "http://127.0.0.1:${NEW_PORT}/api/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 0.3
done
if [ "$healthy" = 1 ]; then
  ok "santé HTTP : 200 sur http://127.0.0.1:${NEW_PORT}"
else
  warn "health KO — journal : journalctl --user -u gent-node -n 30 | tail $GENT_HOME/logs/service.log"
fi

cat <<SUM

  ══════════════════════════════════════════════════════════════════
   GENT DÉMÉNAGÉ — http://127.0.0.1:${NEW_PORT}
  ══════════════════════════════════════════════════════════════════
   Ancien port  : $OLD_PORT (libéré pour ton éditeur)
   Nouveau port : $NEW_PORT
   Ouvrir l'IDE : gent open      (ou le raccourci bureau GENT)
   Revenir      : bash gent-set-port.sh $OLD_PORT
  ══════════════════════════════════════════════════════════════════

SUM

# auto-install : le script se place dans ~/gent/scripts pour les prochaines fois
SELF="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || true)"
if [ -n "$SELF" ] && [ "$SELF" != "$GENT_HOME/scripts/gent-set-port.sh" ] && [ -f "$SELF" ]; then
  cp "$SELF" "$GENT_HOME/scripts/gent-set-port.sh" && chmod 700 "$GENT_HOME/scripts/gent-set-port.sh" \
    && ok "script archivé : ~/gent/scripts/gent-set-port.sh (la prochaine fois : bash ~/gent/scripts/gent-set-port.sh <port>)"
fi
