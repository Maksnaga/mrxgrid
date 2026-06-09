#!/bin/sh
set -e

# Script de build auto déclenché par le webhook GitHub.
#
# Architecture déployée :
#   /output/                        ← bind mount sur /volume1/Web/adeo-grid/
#   ├── index.html  ...             ← Storybook (servi par Web Center à /adeo-grid/)
#   └── adeo-grid-app/                ← Vite demo (à /adeo-grid/adeo-grid-app/)
#
# Web Center Asustor sert /volume1/Web/adeo-grid/ en HTTPS sur le port 443 via
# le DDNS, donc pas besoin de reverse proxy ADM ni de nginx supplémentaire.

REPO_URL="https://github.com/Maksnaga/adeo-grid.git"
WORK_DIR="/tmp/adeo-grid-build"
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
# Storybook prend la racine du volume — c'est lui qui est servi à /adeo-grid/.
echo "[DEPLOY] Building Storybook (base=/adeo-grid/)..."
STORYBOOK_BASE_PATH=/adeo-grid/ npm run build-storybook
# On nettoie tout SAUF le sous-dossier adeo-grid-app/ qui sera réécrit après.
find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 ! -name 'adeo-grid-app' -exec rm -rf {} +
cp -r storybook-static/* "$OUTPUT_DIR/"

# --- App demo (Vite) ------------------------------------------------------
# La demo vit en sous-chemin du Storybook : URL finale
# https://maksnaga.myasustor.com/adeo-grid/adeo-grid-app/
echo "[DEPLOY] Building demo app (base=/adeo-grid/adeo-grid-app/)..."
VITE_BASE=/adeo-grid/adeo-grid-app/ npm run build:app
rm -rf "$OUTPUT_DIR/adeo-grid-app"
mkdir -p "$OUTPUT_DIR/adeo-grid-app"
cp -r dist/* "$OUTPUT_DIR/adeo-grid-app/"

echo "[DEPLOY] Done at $(date)"
echo "[DEPLOY] Output structure:"
ls -la "$OUTPUT_DIR"
