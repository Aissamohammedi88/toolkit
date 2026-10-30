#!/usr/bin/env bash
# =============================================================================
#  GENT — Publication vers l'organisation GitHub (commandes Git prêtes)
#
#  Usage :
#    bash gent-git-push.sh MON-ORG [gent-node22-pfe] [--dry-run]
#
#  Auth (au choix) :
#    export GITHUB_TOKEN=ghp_xxx        → HTTPS push (token JAMAIS affiché)
#    gh auth login                      → CLI GitHub si installé
#    clé SSH configurée                 → git@github.com:ORG/REPO.git
#
#  Sécurité : identity/ (jeton), runtime/, logs/, cache/, workspace/ sont
#  exclus par .gitignore et une garde empêche tout commit contenant identity/.
# =============================================================================
set -Eeuo pipefail
umask 077

log()  { printf '\033[1;35m[gent:git]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  ⚠\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[gent:git:ERREUR]\033[0m %s\n' "$*" >&2; exit 1; }

ORG=""; REPO="gent-node22-pfe"; DRY=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    *) if [ -z "$ORG" ]; then ORG="$a"; else REPO="$a"; fi ;;
  esac
done
[ -n "$ORG" ] || die "usage : bash gent-git-push.sh MON-ORG [gent-node22-pfe] [--dry-run]"
case "$ORG" in */*|*[!A-Za-z0-9._-]*) die "nom d'organisation invalide : $ORG" ;; esac
case "$REPO" in */*|*[!A-Za-z0-9._-]*) die "nom de dépôt invalide : $REPO" ;; esac

command -v git >/dev/null 2>&1 || die "git manquant (sudo apt install git)"
GENT_HOME="${GENT_HOME:-$HOME/gent}"
REPO_DIR="$GENT_HOME/repo"
[ -d "$REPO_DIR/.git" ] || die "dépôt absent dans $REPO_DIR — lance d'abord gent-install.sh"

cd "$REPO_DIR"
log "Dépôt : $REPO_DIR"
log "Cible : github.com/$ORG/$REPO"

# garde anti-fuite : aucun fichier sous identity/ ne doit être suivi
LEAK="$(git status --porcelain | awk '$1!="??"{print $2}' | grep -E '^(identity/|runtime/|logs/|cache/|workspace/|dist/)' || true)"
if [ -n "$LEAK" ]; then
  die "fichiers sensibles en attente de commit — abort :\n$LEAK"
fi
ok "Garde anti-fuite : aucun secret suivi (identity/, runtime/, logs/, cache/)"

# commit des changements éventuels
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain)" ]; then
  [ "$DRY" = 0 ] && git add -A
  if [ "$DRY" = 0 ]; then
    git -c user.name="GENT PFE" -c user.email="gent@localhost" commit -q -m "GENT PFE — build $(grep -o '"build_id": *"[^"]*"' "$GENT_HOME/identity/instance.json" 2>/dev/null | head -n1 | cut -d'"' -f4 || echo local)" \
      && ok "commit enregistré" || ok "rien de nouveau à committer"
  fi
fi
git branch -M main

# remote
if [ -n "${GITHUB_TOKEN:-}" ]; then
  REMOTE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${ORG}/${REPO}.git"
  REMOTE_DISPLAY="https://github.com/${ORG}/${REPO}.git (HTTPS + token, masqué)"
else
  REMOTE_URL="git@github.com:${ORG}/${REPO}.git"
  REMOTE_DISPLAY="git@github.com:${ORG}/${REPO}.git (SSH)"
fi

TAG="v-pfe-$(date +%Y%m%d)"
if [ "$DRY" = 1 ]; then
  cat <<DRY_PLAN

  ── MODE DRY-RUN — commandes qui seraient exécutées ──────────────
  git remote remove origin        (si présent)
  git remote add origin  ${REMOTE_DISPLAY}
  git tag -a ${TAG} -m "GENT Node 22 Premium Founder Edition"
  git push -u origin main
  git push origin --tags
  ────────────────────────────────────────────────────────────────

  Commandes manuelles équivalentes :
    cd ${REPO_DIR}
    git remote add origin git@github.com:${ORG}/${REPO}.git
    git push -u origin main
    git push origin --tags
  ────────────────────────────────────────────────────────────────
DRY_PLAN
  exit 0
fi

git remote remove origin >/dev/null 2>&1 || true
git remote add origin "$REMOTE_URL"
git tag -a "$TAG" -m "GENT Node 22 Premium Founder Edition — instance $(grep -o '"instance_id": *"[^"]*"' "$GENT_HOME/identity/instance.json" 2>/dev/null | head -n1 | cut -d'"' -f4 || echo '?')" 2>/dev/null || ok "tag déjà présent"

log "remote origin → $REMOTE_DISPLAY"

# création du dépôt côté GitHub si gh est disponible
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    log "gh détecté + authentifié — création du dépôt organisation si absent…"
    gh repo view "$ORG/$REPO" >/dev/null 2>&1 \
      && ok "dépôt $ORG/$REPO déjà existant" \
      || { gh repo create "$ORG/$REPO" --private --confirm 2>/dev/null && ok "dépôt privé $ORG/$REPO créé sur GitHub" || warn "création gh échouée — crée-le sur github.com puis relance"; }
  else
    warn "gh présent mais non authentifié — lance : gh auth login"
  fi
else
  warn "gh absent — si le dépôt n'existe pas encore :"
  warn "  https://github.com/organizations/${ORG}/repositories/new  (nom : ${REPO})"
fi

log "push origin main…"
git push -u origin main && ok "main poussé vers $ORG/$REPO"
log "push tags…"
git push origin --tags && ok "tags poussés ($TAG)"

cat <<GIT_DONE

  ══════════════════════════════════════════════════════════════════
   PUBLICATION GITHUB — OK
  ══════════════════════════════════════════════════════════════════
   Dépôt  : https://github.com/${ORG}/${REPO}
   Branche: main · Tag: ${TAG}
   Secrets: identity/ runtime/ logs/ cache/ workspace/ exclus
  ══════════════════════════════════════════════════════════════════

GIT_DONE
