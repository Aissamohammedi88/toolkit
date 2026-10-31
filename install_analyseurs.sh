#!/bin/bash
# Installation des analyseurs de code Python
# Équivalent local de GitHub CodeQL

cd ~/Documents/nexus_autonome
source venv/bin/activate 2>/dev/null || {
    echo "Création du venv..."
    python3 -m venv venv
    source venv/bin/activate
}

echo "═══════════════════════════════════════"
echo "  INSTALLATION DES ANALYSEURS"
echo "═══════════════════════════════════════"

pip install --quiet --upgrade pip

# Linters
pip install --quiet pylint flake8 ruff

# Vérification de types
pip install --quiet mypy

# Sécurité
pip install --quiet bandit

# Formatage
pip install --quiet black isort

# Analyse de complexité
pip install --quiet radon

echo ""
echo "✅ Analyseurs installés :"
echo "   - pylint   : erreurs + style + complexité"
echo "   - flake8   : PEP8 + erreurs"
echo "   - ruff     : ultra-rapide (remplace flake8)"
echo "   - mypy     : vérification de types"
echo "   - bandit   : sécurité"
echo "   - black    : formatage"
echo "   - isort    : tri des imports"
echo "   - radon    : complexité cyclomatique"
