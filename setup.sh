#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# BahiKhata — One-time Server Setup
# Ubuntu 22.04 | app.thekechi.com
# Run as root: bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Exit on any error

DOMAIN="app.thekechi.com"
APP_DIR="/var/www/bahikhata"
REPO_URL="https://github.com/Rajpreetgiri/bahikhata.git"          # <-- Fill in: https://github.com/yourusername/bahikhata.git
MONGO_ADMIN_PASS="KoiStrongPassword123@!"  # <-- Fill in: strong admin password
MONGO_APP_PASS="KoiStrongPassword123@!"    # <-- Fill in: strong app password
BACKEND_PORT=5000

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
die()  { echo -e "${RED}[✗] $1${NC}"; exit 1; }

# ─── Preflight checks ─────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Run as root: sudo bash setup.sh"
[[ -z "$REPO_URL" ]] && die "Set REPO_URL at the top of this script"
[[ -z "$MONGO_ADMIN_PASS" ]] && die "Set MONGO_ADMIN_PASS at the top of this script"
[[ -z "$MONGO_APP_PASS" ]] && die "Set MONGO_APP_PASS at the top of this script"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  BahiKhata Server Setup — $DOMAIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. System update ─────────────────────────────────────────────────────────
log "Updating system packages..."
apt update && apt upgrade -y
apt install -y curl git ufw nginx certbot python3-certbot-nginx build-essential

# ─── 2. Node.js 20 ────────────────────────────────────────────────────────────
log "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v && npm -v
log "Node.js installed: $(node -v)"

# ─── 3. PM2 ───────────────────────────────────────────────────────────────────
log "Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash
log "PM2 installed"

# ─── 4. MongoDB 7 ─────────────────────────────────────────────────────────────
log "Installing MongoDB 7..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  | tee /etc/apt/sources.list.d/mongodb-org-7.0.list

apt update && apt install -y mongodb-org
systemctl start mongod && systemctl enable mongod
log "MongoDB started"

# ─── 5. MongoDB users (auth disabled initially) ───────────────────────────────
log "Creating MongoDB users..."
mongosh --quiet <<EOF
use admin
db.createUser({
  user: "adminUser",
  pwd: "$MONGO_ADMIN_PASS",
  roles: ["userAdminAnyDatabase", "readWriteAnyDatabase", "dbAdminAnyDatabase"]
})
use bahikhata
db.createUser({
  user: "bahikhata_user",
  pwd: "$MONGO_APP_PASS",
  roles: [{ role: "readWrite", db: "bahikhata" }]
})
EOF
log "MongoDB users created"

# ─── 6. Enable MongoDB auth ───────────────────────────────────────────────────
log "Enabling MongoDB authentication..."
cat > /etc/mongod.conf <<MONGOCONF
storage:
  dbPath: /var/lib/mongodb

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 0.0.0.0

security:
  authorization: enabled

processManagement:
  timeZoneInfo: /usr/share/zoneinfo
MONGOCONF

systemctl restart mongod
log "MongoDB auth enabled"

# ─── 7. Redis ─────────────────────────────────────────────────────────────────
log "Installing Redis..."
apt install -y redis-server
sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
systemctl restart redis-server && systemctl enable redis-server
log "Redis started"

# ─── 8. Firewall ──────────────────────────────────────────────────────────────
log "Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
# MongoDB: replace with your actual home/office IP
warn "Add your local machine IP for MongoDB access:"
warn "  ufw allow from YOUR_HOME_IP to any port 27017"
ufw --force enable
log "Firewall configured"

# ─── 9. Clone repo ────────────────────────────────────────────────────────────
log "Cloning repository..."
mkdir -p $APP_DIR
git clone $REPO_URL $APP_DIR
log "Repository cloned to $APP_DIR"

# ─── 10. Backend .env ─────────────────────────────────────────────────────────
log "Creating backend .env..."
cat > $APP_DIR/backend/.env <<ENVFILE
# ── Database ──────────────────────────────────────────────
MONGODB_URI=mongodb://bahikhata_user:$MONGO_APP_PASS@localhost:27017/bahikhata

# ── Redis ─────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Server ────────────────────────────────────────────────
PORT=$BACKEND_PORT
NODE_ENV=production
FRONTEND_URL=https://$DOMAIN

# ── Auth (CHANGE THESE!) ──────────────────────────────────
JWT_SECRET=CHANGE_THIS_TO_64_CHAR_RANDOM_STRING_MINIMUM_32_CHARS
ADMIN_USERNAME=admin
ADMIN_PASSWORD=CHANGE_THIS_ADMIN_PASSWORD
ADMIN_JWT_SECRET=CHANGE_THIS_ADMIN_JWT_SECRET_MIN_32_CHARS

# ── Razorpay ──────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# ── Fast2SMS ──────────────────────────────────────────────
FAST2SMS_API_KEY=your_fast2sms_api_key

# ── Gmail ─────────────────────────────────────────────────
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# ── MSG91 (IVR) ───────────────────────────────────────────
MSG91_AUTH_KEY=your_msg91_key
ENVFILE

warn "⚠️  IMPORTANT: Edit $APP_DIR/backend/.env and fill in all secrets!"
warn "   nano $APP_DIR/backend/.env"

# ─── 11. Build backend ────────────────────────────────────────────────────────
log "Building backend..."
cd $APP_DIR/backend
npm install
npm run build
log "Backend built"

# ─── 12. Build frontend ───────────────────────────────────────────────────────
log "Building frontend..."
cd $APP_DIR/frontend
npm install
npm run build
log "Frontend built"

# ─── 13. PM2 ecosystem config ─────────────────────────────────────────────────
log "Creating PM2 ecosystem config..."
cat > $APP_DIR/ecosystem.config.js <<'PM2CONF'
module.exports = {
  apps: [{
    name: 'bahikhata-api',
    script: './backend/dist/index.js',
    cwd: '/var/www/bahikhata',
    instances: 2,
    exec_mode: 'cluster',
    watch: false,
    env: {
      NODE_ENV: 'production',
    },
    error_file: '/var/log/bahikhata/err.log',
    out_file: '/var/log/bahikhata/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '500M',
    restart_delay: 3000,
    max_restarts: 10,
  }]
}
PM2CONF

mkdir -p /var/log/bahikhata
log "PM2 config created"

# ─── 14. Start PM2 ────────────────────────────────────────────────────────────
log "Starting app with PM2..."
cd $APP_DIR
pm2 start ecosystem.config.js
pm2 save
log "App started with PM2"

# ─── 15. Nginx config ─────────────────────────────────────────────────────────
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/bahikhata <<NGINXCONF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend — React SPA
    root $APP_DIR/frontend/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Static assets — long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        client_max_body_size 10M;
    }

    # Uploads folder
    location /uploads {
        alias $APP_DIR/backend/uploads;
        expires 30d;
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/bahikhata /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
log "Nginx configured"

# ─── 16. SSL with Certbot ─────────────────────────────────────────────────────
log "Setting up SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@thekechi.com
log "SSL certificate installed"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}  Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  App URL    : https://$DOMAIN"
echo "  App dir    : $APP_DIR"
echo "  PM2 logs   : pm2 logs bahikhata-api"
echo "  PM2 status : pm2 status"
echo ""
echo -e "${YELLOW}  NEXT STEPS:${NC}"
echo "  1. nano $APP_DIR/backend/.env   ← Fill in all secrets"
echo "  2. pm2 restart bahikhata-api    ← Apply env changes"
echo "  3. Add MongoDB firewall rule:"
echo "     ufw allow from YOUR_HOME_IP to any port 27017"
echo ""
echo "  MongoDB Compass connection string:"
echo "  mongodb://adminUser:$MONGO_ADMIN_PASS@YOUR_SERVER_IP:27017/bahikhata?authSource=admin"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
