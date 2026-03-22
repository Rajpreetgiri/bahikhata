#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# BahiKhata — Deploy Script
# Run after every git pull: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

APP_DIR="/var/www/bahikhata"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
die()  { echo -e "${RED}[✗] $1${NC}"; exit 1; }

cd $APP_DIR

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  BahiKhata Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. Git pull ──────────────────────────────────────────────────────────────
log "Pulling latest code..."
git pull origin main
log "Code updated"

# ─── 2. Backend ───────────────────────────────────────────────────────────────
log "Installing backend dependencies..."
cd $APP_DIR/backend
npm install --production=false   # need devDeps for tsc

log "Building backend (TypeScript)..."
npm run build
log "Backend built"

# ─── 3. Frontend ──────────────────────────────────────────────────────────────
log "Installing frontend dependencies..."
cd $APP_DIR/frontend
npm install

log "Building frontend (Vite)..."
npm run build
log "Frontend built"

# ─── 4. Reload PM2 ────────────────────────────────────────────────────────────
log "Reloading PM2 (zero-downtime)..."
cd $APP_DIR
pm2 reload bahikhata-api
log "PM2 reloaded"

# ─── 5. Reload Nginx ──────────────────────────────────────────────────────────
nginx -t && systemctl reload nginx
log "Nginx reloaded"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}  Deploy Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  pm2 logs bahikhata-api   ← Live logs"
echo "  pm2 status               ← Process status"
echo ""
