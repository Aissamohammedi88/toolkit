#!/usr/bin/env bash
# =============================================================================
#  GENT — Script de Build Premium (Founder Edition)
#  Intégrité runtime → warmup compile-cache V8 → manifeste SHA256 → tarball
#  distribution → registre de builds append-only.
#
#  Usage : gent build   |   bash gent-build.sh
# =============================================================================
set -Eeuo pipefail
umask 077

log()  { printf '\033[1;35m[gent:build]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  ⚠\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[gent:build:ERREUR]\033[0m %s\n' "$*" >&2; exit 1; }

GENT_HOME="${GENT_HOME:-$HOME/gent}"
[ -d "$GENT_HOME/identity" ] || die "aucune identité GENT dans $GENT_HOME — lance d'abord gent-install.sh"

case "$(uname -m)" in
  x86_64) GARCH="x64" ;;
  aarch64|arm64) GARCH="arm64" ;;
  *) GARCH="$(uname -m)" ;;
esac

NODE_BIN="$GENT_HOME/runtime/current/bin/node"
[ -x "$NODE_BIN" ] || { NODE_BIN="$(command -v node || true)"; [ -n "$NODE_BIN" ] || die "aucun runtime node trouvé"; warn "runtime GENT absent — build avec node système"; }

NODE_VER="$("$NODE_BIN" --version)"
NV_CLEAN="${NODE_VER#v}"

# ---------------------------------------------------------- 1. intégrité ---
log "1/5 — Intégrité du runtime cloné"
RUNTIME_SHA="$(sha256sum "$NODE_BIN" | awk '{print $1}')"
ok "sha256(node $NODE_VER) = ${RUNTIME_SHA:0:24}…"
SHASUMS="$GENT_HOME/cache/dist/SHASUMS256.txt"
TARBALL="$GENT_HOME/cache/dist/node-v${NV_CLEAN}-linux-${GARCH}.tar.gz"
if [ -f "$TARBALL" ] && [ -f "$SHASUMS" ]; then
  WANT="$(awk -v f="node-v${NV_CLEAN}-linux-${GARCH}.tar.gz" '$2==f{print $1}' "$SHASUMS")"
  GOT="$(sha256sum "$TARBALL" | awk '{print $1}')"
  if [ -n "$WANT" ] && [ "$WANT" = "$GOT" ]; then
    ok "tarball d'origine re-vérifié contre SHASUMS256.txt officiel"
  else
    die "divergence SHA256 entre runtime et SHASUMS officiels — réinstalle"
  fi
else
  warn "cache tarball absent — vérification binaire seule (accepté)"
fi

# --------------------------------------------- 2. warmup compile-cache V8 ---
log "2/5 — Warmup du compile-cache V8 (démarrages accélérés)"
CACHE_DIR="$GENT_HOME/cache/v8"
mkdir -p "$CACHE_DIR"
GENT_WARMUP=1 GENT_HOME="$GENT_HOME" NODE_COMPILE_CACHE="$CACHE_DIR" "$NODE_BIN" --max-semi-space-size=64 "$GENT_HOME/app/gent-server.js" \
  || die "warmup échoué"
CACHE_N="$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)"
ok "compile-cache alimenté : $CACHE_N artefacts dans cache/v8"

# ------------------------------------------------- 3. manifeste d'intégrité ---
log "3/5 — Manifeste SHA256 de l'application"
BUILD_N=$(( $(wc -l < "$GENT_HOME/identity/builds.log" 2>/dev/null || echo 0) + 1 ))
BUILD_ID="pfe.${NV_CLEAN}.$(date +%Y%m%d-%H%M%S).n${BUILD_N}"
MAN_DIR="$GENT_HOME/identity/manifests"
mkdir -p "$MAN_DIR"
MANIFEST="$MAN_DIR/${BUILD_ID}.sha256"
(
  cd "$GENT_HOME"
  sha256sum app/gent-server.js bin/gent bin/gent-node bin/gent-npm bin/gent-npx 2>/dev/null
  [ -f share/gent.svg ] && sha256sum share/gent.svg
  [ -f scripts/gent-build.sh ] && sha256sum scripts/gent-build.sh
) > "$MANIFEST"
MAN_COUNT="$(wc -l < "$MANIFEST")"
ok "manifeste : $MANIFEST ($MAN_COUNT entrées)"

# ------------------------------------------------------ 4. tarball dist ---
log "4/5 — Tarball distribution Premium (sources prêtes GitHub)"
mkdir -p "$GENT_HOME/dist"
DIST="$GENT_HOME/dist/gent-node22-pfe-${BUILD_ID}-linux-${GARCH}.tar.gz"
tar -czf "$DIST" -C "$GENT_HOME" repo
DIST_SHA="$(sha256sum "$DIST" | awk '{print $1}')"
DIST_SIZE="$(du -h "$DIST" | awk '{print $1}')"
ok "dist : $DIST ($DIST_SIZE)"
ok "sha256(dist) = ${DIST_SHA:0:24}…"

# ------------------------------------------- 5. registre + identité stamp ---
log "5/5 — Registre de builds (append-only) + stamp identité"
printf '%s | %s | node=%s | runtime_sha=%s | dist=%s | dist_sha=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$BUILD_ID" "$NODE_VER" "${RUNTIME_SHA:0:16}" "$(basename "$DIST")" "${DIST_SHA:0:16}" \
  >> "$GENT_HOME/identity/builds.log"

if [ -f "$GENT_HOME/identity/instance.json" ]; then
  sed -i "s/\"build_id\": \"[^\"]*\"/\"build_id\": \"${BUILD_ID}\"/" "$GENT_HOME/identity/instance.json"
  sed -i "s/\"version\": \"v[0-9.]*\"/\"version\": \"${NODE_VER}\"/" "$GENT_HOME/identity/instance.json" || true
  chmod 600 "$GENT_HOME/identity/instance.json"
fi
# synchronise le dépôt avec l'app buildée
cp "$GENT_HOME/app/gent-server.js" "$GENT_HOME/repo/app/gent-server.js" 2>/dev/null || true
ok "identité stampée : build_id = $BUILD_ID"

cat <<BUILD_SUMMARY

  ══════════════════════════════════════════════════════════════════
   BUILD PREMIUM TERMINÉ — $BUILD_ID
  ══════════════════════════════════════════════════════════════════
   Runtime      : $NODE_VER (sha256 ${RUNTIME_SHA:0:16}…)
   Compile-cache: $CACHE_N artefacts (V8 startup accéléré)
   Manifeste    : $MANIFEST
   Dist         : $DIST ($DIST_SIZE)
   Registre     : $GENT_HOME/identity/builds.log (ligne #$BUILD_N)

   Suivant :
     bash $GENT_HOME/scripts/gent-verify.sh
     bash $GENT_HOME/scripts/gent-git-push.sh MON-ORG gent-node22-pfe
  ══════════════════════════════════════════════════════════════════

BUILD_SUMMARY
