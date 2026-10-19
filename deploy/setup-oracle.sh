#!/bin/bash
# =============================================================
# SCRIPT SETUP OTOMATIS - Oracle Cloud VM (Ubuntu 22.04 ARM)
# yt-manajemen v4.37.0
# Jalankan sebagai: sudo bash setup-oracle.sh
# =============================================================

set -e

echo "============================================"
echo "  Setup yt-manajemen di Oracle Cloud VM"
echo "============================================"

# --- 1. Update sistem ---
echo "[1/8] Update sistem..."
apt-get update -y && apt-get upgrade -y

# --- 2. Install Docker ---
echo "[2/8] Install Docker..."
apt-get install -y ca-certificates curl gnupg lsb-release
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# --- 3. Aktifkan Docker ---
echo "[3/8] Aktifkan Docker service..."
systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# --- 4. Buka firewall Oracle Cloud ---
echo "[4/8] Konfigurasi firewall (iptables)..."
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
netfilter-persistent save 2>/dev/null || apt-get install -y iptables-persistent && netfilter-persistent save

# --- 5. Buat folder deploy ---
echo "[5/8] Buat struktur folder..."
mkdir -p /opt/yt-manajemen/deploy/ssl

# --- 6. Install certbot (SSL gratis via Let's Encrypt) ---
echo "[6/8] Install Certbot untuk SSL gratis..."
apt-get install -y snapd
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot

# --- 7. Buat .env dari template ---
echo "[7/8] Setup environment variables..."
if [ ! -f /opt/yt-manajemen/.env ]; then
    cat > /opt/yt-manajemen/.env << 'EOF'
# WAJIB DIISI - Ganti semua nilai placeholder ini!
APP_URL=https://IP-ATAU-DOMAIN-KAMU
APP_SECRET=GANTI_SECRET_ACAK_MINIMAL_32_KARAKTER
ADMIN_PASSWORD=GANTI_PASSWORD_ADMIN_KAMU
DB_PASSWORD=GANTI_PASSWORD_DATABASE_KAMU

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI (opsional)
AI_PROVIDER=groq
GROQ_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Worker
WORKER_ENABLED=true
WORKER_INTERVAL_MS=5000
YOUTUBE_CHUNK_MB=8
AI_AUTO_FALLBACK=true
AI_DAILY_LIMIT=50
EOF
    echo "  --> File .env dibuat di /opt/yt-manajemen/.env"
    echo "  --> PENTING: Edit file .env sebelum jalankan docker compose!"
fi

# --- 8. Selesai ---
echo ""
echo "[8/8] Setup selesai!"
echo ""
echo "============================================"
echo "  LANGKAH SELANJUTNYA:"
echo "============================================"
echo ""
echo "1. Salin file proyek ke VM:"
echo "   scp -r ./yt-manajemen ubuntu@IP-VM:/opt/"
echo ""
echo "2. Edit variabel environment:"
echo "   nano /opt/yt-manajemen/.env"
echo ""
echo "3. (Opsional) Setup SSL dengan domain:"
echo "   certbot certonly --standalone -d domain-kamu.com"
echo "   cp /etc/letsencrypt/live/domain-kamu.com/fullchain.pem /opt/yt-manajemen/deploy/ssl/cert.pem"
echo "   cp /etc/letsencrypt/live/domain-kamu.com/privkey.pem /opt/yt-manajemen/deploy/ssl/key.pem"
echo ""
echo "4. Jalankan aplikasi:"
echo "   cd /opt/yt-manajemen"
echo "   docker compose up -d"
echo ""
echo "5. Cek status:"
echo "   docker compose ps"
echo "   docker compose logs -f app"
echo ""
echo "  Health check: http://IP-VM/api/health"
echo "============================================"
