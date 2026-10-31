#!/usr/bin/env python3
"""NEXUS NODE.PY — Pont Python vers Node.js"""
import subprocess
import json
import os

class NodeBridge:
    def __init__(self):
        self.base = os.path.dirname(os.path.abspath(__file__))

    def lancer(self):
        """Lance l'application Node.js."""
        subprocess.Popen(["npm", "start"], cwd=self.base)
        print("[NODE.PY] Application Node.js lancée")

    def stop(self):
        """Arrête l'application."""
        subprocess.run(["pkill", "-f", "index.js"], capture_output=True)
        print("[NODE.PY] Application arrêtée")

    def exec_js(self, code):
        """Exécute du JavaScript depuis Python."""
        resultat = subprocess.run(["node", "-e", code], capture_output=True, text=True)
        return resultat.stdout or resultat.stderr

    def get_status(self):
        """Vérifie si l'app tourne."""
        resultat = subprocess.run(["pgrep", "-f", "index.js"], capture_output=True, text=True)
        return bool(resultat.stdout.strip())

if name == "__main__":
    bridge = NodeBridge()
    print("NEXUS NODE.PY — prêt")
    print("bridge.lancer() → lance l'app")
    print("bridge.exec_js('console.log(1+1)') → exécute JS")
    print("bridge.get_status() → vérifie l'état")
