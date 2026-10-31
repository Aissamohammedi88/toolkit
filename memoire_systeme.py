#!/usr/bin/env python3
import os

def lire_memoire():
    with open('/proc/meminfo', 'r') as f:
        lignes = f.readlines()
    infos = {}
    for ligne in lignes[:10]:
        cle, val = ligne.split(':')
        infos[cle.strip()] = val.strip()
    return infos

if name == "__main__":
    mem = lire_memoire()
    for cle, val in mem.items():
        print(f"{cle} : {val}")
