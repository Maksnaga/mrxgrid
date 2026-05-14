#!/bin/sh
set -e

REPO_URL="https://github.com/Maksnaga/mrxgrid.git"
WORK_DIR="/tmp/mrxgrid-build"
OUTPUT_DIR="/output"

echo "[DEPLOY] Starting at $(date)"

# Clone or pull
if [ -d "$WORK_DIR/.git" ]; then
  echo "[DEPLOY] Pulling latest changes..."
  cd "$WORK_DIR"
  git fetch origin main
  git reset --hard origin/main
else
  echo "[DEPLOY] Cloning repository..."
  git clone --depth 1 --branch main "$REPO_URL" "$WORK_DIR"
  cd "$WORK_DIR"
fi

echo "[DEPLOY] Installing dependencies..."
npm ci

echo "[DEPLOY] Building Storybook..."
npm run build-storybook

echo "[DEPLOY] Copying to output..."
rm -rf "$OUTPUT_DIR"/*
cp -r storybook-static/* "$OUTPUT_DIR"/

echo "[DEPLOY] Done at $(date)"
