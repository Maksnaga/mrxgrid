#!/bin/sh
set -e

# Script de build auto déclenché par le webhook GitHub.
#
# Architecture déployée :
#   /output/                        ← bind mount sur /volume1/Web/mrxgrid/
#   ├── index.html  ...             ← Storybook (servi par Web Center à /mrxgrid/)
#   └── mrxgrid-app/                ← Vite demo (à /mrxgrid/mrxgrid-app/)
#
# Web Center Asustor sert /volume1/Web/mrxgrid/ en HTTPS sur le port 443 via
# le DDNS, donc pas besoin de reverse proxy ADM ni de nginx supplémentaire.

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

# --- Storybook ------------------------------------------------------------
# Storybook prend la racine du volume — c'est lui qui est servi à /mrxgrid/.
echo "[DEPLOY] Building Storybook (base=/mrxgrid/)..."
STORYBOOK_BASE_PATH=/mrxgrid/ npm run build-storybook
# On nettoie tout SAUF le sous-dossier mrxgrid-app/ qui sera réécrit après.
find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 ! -name 'mrxgrid-app' -exec rm -rf {} +
cp -r storybook-static/* "$OUTPUT_DIR/"

# --- App demo (Vite) ------------------------------------------------------
# La demo vit en sous-chemin du Storybook : URL finale
# https://maksnaga.myasustor.com/mrxgrid/mrxgrid-app/
echo "[DEPLOY] Building demo app (base=/mrxgrid/mrxgrid-app/)..."
VITE_BASE=/mrxgrid/mrxgrid-app/ npm run build:app
rm -rf "$OUTPUT_DIR/mrxgrid-app"
mkdir -p "$OUTPUT_DIR/mrxgrid-app"
cp -r dist/* "$OUTPUT_DIR/mrxgrid-app/"

echo "[DEPLOY] Done at $(date)"
echo "[DEPLOY] Output structure:"
ls -la "$OUTPUT_DIR"
