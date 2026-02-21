#!/usr/bin/env bash
# Render build script for TalentLens Backend
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt
