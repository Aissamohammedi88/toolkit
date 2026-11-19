#!/usr/bin/env bash
# ==========================================================================
#  start.sh — NERCEL v10.0
#  Démarre orchestrateur + edge NEXUS, vérifie, ouvre le navigateur.
#  Dépendances : Python 3.8+ (stdlib). Optionnel : git (GitHub deploy), z-ai (GLM).
#
#  bash start.sh             # démarre
#  bash start.sh --stop      # arrête
#  bash start.sh --status    # état
#  bash start.sh --restart   # redémarre
# ==========================================================================
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${NERCEL_PORT:-3923}"
EDGE_PORT="${NERCEL_EDGE_PORT:-8765}"
DATA_DIR="${NERCEL_DATA:-$HOME/.nercel}"
PID_O="$DATA_DIR/nercel.pid"
PID_E="$DATA_DIR/nexusd.pid"

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; CYAN=$'\033[0;36m'; DIM=$'\033[2m'; B=$'\033[1m'; NC=$'\033[0m'
ok(){ printf "${GREEN}✓${NC} %s\n" "$*"; }
err(){ printf "${RED}✗ %s${NC}\n" "$*" >&2; }
info(){ printf "${CYAN}▸${NC} %s\n" "$*"; }

PY=""
for c in python3 python; do
  command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys;sys.exit(0 if sys.version_info>=(3,8)else 1)' 2>/dev/null && { PY="$c"; break; }
done
port_up(){ "$PY" -c "import socket,sys;s=socket.socket();s.settimeout(0.5);sys.exit(0 if s.connect_ex(('127.0.0.1', $1))==0 else 1)" 2>/dev/null; }

stop_all(){
  for f in "$PID_O" "$PID_E"; do
    [ -f "$f" ] && { pid=$(cat "$f" 2>/dev/null); [ -n "$pid" ] && kill "$pid" 2>/dev/null && ok "PID $pid arrêté"; rm -f "$f"; }
  done
  pkill -f "server\.py" 2>/dev/null; pkill -f "nexusd\.py" 2>/dev/null
  sleep 1
}

case "${1:-}" in
  --stop)   stop_all; ok "NERCEL arrêté"; exit 0 ;;
  --status) [ -z "$PY" ] && { err "Python 3.8+ requis"; exit 1; }; exec "$PY" "$HERE/nercel" status ;;
  --restart) stop_all ;;
  --open)   OPEN_BROWSER=1 ;;   # démarre + ouvre le navigateur (sinon rien ne s'ouvre)
  *)        OPEN_BROWSER="${NERCEL_OPEN:-0}" ;;
esac

[ -z "$PY" ] && { err "Python 3.8+ requis (apt install python3)"; exit 1; }
[ "$(id -u)" = "0" ] && { err "Ne lance pas NERCEL en root."; exit 1; }

mkdir -p "$DATA_DIR/logs" "$DATA_DIR/ai"

if port_up "$PORT" || port_up "$EDGE_PORT"; then
  info "instance déjà en marche → relance…"; stop_all
fi

info "Démarrage orchestrateur :$PORT"
nohup "$PY" "$HERE/server.py" >>"$DATA_DIR/logs/orchestrator.log" 2>&1 &
echo $! > "$PID_O"
info "Démarrage edge NEXUS :$EDGE_PORT"
nohup "$PY" "$HERE/nexusd.py" >>"$DATA_DIR/logs/edge.log" 2>&1 &
echo $! > "$PID_E"
chmod +x "$HERE/nercel" 2>/dev/null

OK_O=0; OK_E=0
for i in $(seq 1 15); do
  port_up "$PORT" && OK_O=1
  port_up "$EDGE_PORT" && OK_E=1
  [ "$OK_O" = 1 ] && [ "$OK_E" = 1 ] && break
  sleep 1
done

if [ "$OK_O" = 1 ] && [ "$OK_E" = 1 ]; then
  cat <<EOF

$(ok "NERCEL v10.0 est en ligne")

  ${B}Dashboard${NC}  :  http://127.0.0.1:$PORT/
  ${B}Edge proxy${NC}  :  http://127.0.0.1:$EDGE_PORT/
  ${B}Docs${NC}        :  http://127.0.0.1:$PORT/docs
  ${B}Données${NC}     :  $DATA_DIR

EOF
  # dépendances optionnelles
  command -v git >/dev/null 2>&1 || printf "${DIM}  ⚠ git absent — déploiement GitHub désactivé${NC}\n"
  command -v z-ai >/dev/null 2>&1 || printf "${DIM}  ⚠ z-ai absent — chat GLM Flash désactivé (Pollinations reste OK)${NC}\n"
  printf "${DIM}\n  CLI       :  $HERE/nercel register <u> <p> | login | whoami | deploy app.zip | agent list | ai \"...\"
  Ouvrir    :  bash start.sh --open   (le navigateur ne s'ouvre PAS tout seul)
  Arrêter   :  bash start.sh --stop${NC}\n\n"
  # ouverture navigateur UNIQUEMENT si demandée explicitement (--open / NERCEL_OPEN=1)
  if [ "${OPEN_BROWSER:-0}" = "1" ]; then
    command -v xdg-open >/dev/null 2>&1 && ( sleep 0.5 && xdg-open "http://127.0.0.1:$PORT/" >/dev/null 2>&1 ) &
  fi
else
  err "Un serveur n'a pas démarré. Logs :"
  tail -8 "$DATA_DIR/logs/orchestrator.log" 2>/dev/null | sed 's/^/  /'
  exit 1
fi
