#!/bin/bash

# fail immediately
set -e

virtualenv virtualenv
source virtualenv/bin/activate
pip install -r requirements.txt
# python settle.py
