#!/bin/bash
# ============================================================
# Script restore backup ke PostgreSQL Oracle Cloud
# Jalankan dari komputer lokal (Windows/Linux/Mac)
# ============================================================

BACKUP_FILE="$1"
DB_URL="$2"

if [ -z "$BACKUP_FILE" ] || [ -z "$DB_URL" ]; then
    echo "Penggunaan: bash restore.sh <file-backup.json.gz> <DATABASE_URL>"
    echo ""
    echo "Contoh:"
    echo "  bash restore.sh backup.json.gz postgresql://user:pass@host:port/db"
    exit 1
fi

echo "============================================"
echo "  Restore Backup ke PostgreSQL"
echo "============================================"
echo "File backup : $BACKUP_FILE"
echo ""

# Validasi dulu
echo "[1/2] Validasi backup..."
DATABASE_URL="$DB_URL" STORAGE_RESTORE_OFFLINE=true node storage-restore.mjs "$BACKUP_FILE"

echo ""
echo "Validasi selesai. Lanjutkan restore? (ketik 'ya' untuk konfirmasi)"
read -r CONFIRM

if [ "$CONFIRM" != "ya" ]; then
    echo "Restore dibatalkan."
    exit 0
fi

# Apply restore
echo "[2/2] Menerapkan restore ke database..."
DATABASE_URL="$DB_URL" STORAGE_RESTORE_OFFLINE=true node storage-restore.mjs "$BACKUP_FILE" --apply

echo ""
echo "============================================"
echo "  Restore selesai!"
echo "  Jalankan ulang aplikasi dan cek data."
echo "============================================"
