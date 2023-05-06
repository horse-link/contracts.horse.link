#!/bin/bash

cd contracts.horse.link/
git stash
git pull
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python scripts/result.py