rc/generator.py```python
import os
import json
import itertools
import asyncio
import aiohttp
from pathlib import Path
from typing import Dict, List
from utils import load_api_token, fetch_repo_meta, write_workflow
from validator import validate_yaml
from scorer import score_workflow

API_URL = "https://api.github.com"

async def fetch_triggers(session, repo):
    # Exemple simplifié : pull_request, push, schedule
    return ["push", "pull_request", "schedule"]

async def generate_permutations(triggers: List[str], jobs: List[str], steps: List[str]):
    # Génère toutes les combinaisons (exemple très réduit)
    for trig in triggers:
        for job in jobs:
            for step in steps:
                yield {
                    "name": f"{job} on {trig}",
                    "on": trig,
                    "jobs": {
                        job
